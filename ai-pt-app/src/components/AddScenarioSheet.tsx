import { useMemo, useState } from 'react'
import type { Scenario } from '../types'
import { CUSTOM_SCENARIO_PROMPT } from '../logic/prompts'
import { parseScenarioJson, type ScenarioInput } from '../logic/customScenario'
import { blockToText } from '../data/scenarios'
import { copyText, downloadTextFile } from '../logic/clipboard'
import { Sheet } from './Sheet'

type Props = {
  onClose: () => void
  onSave: (scenarios: Scenario[]) => void
  editing?: Scenario | null
  apiReady: boolean
  onOpenSettings: () => void
  onGenerate: (keyword: string) => Promise<unknown>
}

type Tab = 'form' | 'json' | 'ai'

type FormState = {
  title: string
  field: string
  background: string
  mission: string
  constraints: string
  r1Title: string
  r1Summary: string
  r1Content: string
  r2Title: string
  r2Summary: string
  r2Content: string
  traps: string
}

const EMPTY_FORM: FormState = {
  title: '',
  field: '보건',
  background: '',
  mission: '',
  constraints: '답안 3,000자 이내(공백 포함)\n결론을 먼저 쓰고 근거·대가·실행계획 순으로 작성\n자료에 없는 값은 "자료 없음"으로 표시',
  r1Title: '자료 1',
  r1Summary: '',
  r1Content: '',
  r2Title: '자료 2',
  r2Summary: '',
  r2Content: '',
  traps: '',
}

function formFromScenario(scenario: Scenario): FormState {
  const [r1, r2] = scenario.resources
  const content = (resource?: Scenario['resources'][number]) =>
    resource ? resource.blocks.map(block => blockToText(block)).join('\n\n') : ''
  return {
    title: scenario.title,
    field: scenario.field,
    background: scenario.background,
    mission: scenario.mission,
    constraints: scenario.constraints.join('\n'),
    r1Title: r1?.title ?? '자료 1',
    r1Summary: r1?.summary ?? '',
    r1Content: content(r1),
    r2Title: r2?.title ?? '자료 2',
    r2Summary: r2?.summary ?? '',
    r2Content: content(r2),
    traps: scenario.traps.map(trap => `${trap.title} :: ${trap.detail}`).join('\n'),
  }
}

function formToInput(form: FormState): ScenarioInput {
  const traps = form.traps
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [title, ...rest] = line.split('::')
      return { title: (title ?? '').trim(), detail: rest.join('::').trim() }
    })
    .filter(trap => trap.title && trap.detail)

  return {
    title: form.title,
    field: form.field,
    background: form.background,
    mission: form.mission,
    constraints: form.constraints.split('\n').map(line => line.trim()).filter(Boolean),
    resources: [
      { label: '자료 1', title: form.r1Title, summary: form.r1Summary, content: form.r1Content },
      { label: '자료 2', title: form.r2Title, summary: form.r2Summary, content: form.r2Content },
    ],
    traps,
  }
}

function Preview({ scenarios }: { scenarios: Scenario[] }) {
  return (
    <div className="preview-list">
      {scenarios.map(scenario => (
        <article key={scenario.id} className="preview-card">
          <h4>
            <span className="badge badge-custom">{scenario.field}</span> {scenario.title}
          </h4>
          <p className="preview-mission">{scenario.mission}</p>
          <ul className="preview-meta">
            {scenario.resources.map(resource => (
              <li key={resource.id}>
                <strong>{resource.label}</strong> {resource.title}
                <span className="muted">
                  {' '}
                  · 블록 {resource.blocks.length}개
                  {resource.blocks.some(block => block.kind === 'table')
                    ? ` (표 ${resource.blocks.filter(block => block.kind === 'table').length}개)`
                    : ''}
                </span>
              </li>
            ))}
            <li>
              <strong>함정</strong> {scenario.traps.length}개
              {scenario.traps.length ? ` — ${scenario.traps.map(trap => trap.title).join(' / ')}` : ''}
            </li>
          </ul>
        </article>
      ))}
    </div>
  )
}

export function AddScenarioSheet({ onClose, onSave, editing, apiReady, onOpenSettings, onGenerate }: Props) {
  const [tab, setTab] = useState<Tab>(editing ? 'form' : 'form')
  const [form, setForm] = useState<FormState>(() => (editing ? formFromScenario(editing) : EMPTY_FORM))
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState<Scenario[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [aiKeyword, setAiKeyword] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: event.target.value }))

  const reset = () => {
    setPreview(null)
    setErrors([])
    setWarnings([])
  }

  const validateInput = (input: ScenarioInput) => {
    const outcome = parseScenarioJson(JSON.stringify(input))
    setErrors(outcome.errors)
    setWarnings(outcome.warnings)
    if (outcome.ok) setPreview(outcome.scenarios)
    else setPreview(null)
  }

  const validateJson = () => {
    const outcome = parseScenarioJson(jsonText)
    setErrors(outcome.errors)
    setWarnings(outcome.warnings)
    setPreview(outcome.ok ? outcome.scenarios : null)
  }

  const save = () => {
    if (!preview?.length) return
    const list = editing ? preview.map(item => ({ ...item, id: editing.id, code: editing.code })) : preview
    onSave(list)
    onClose()
  }

  const generate = async () => {
    if (!apiReady) {
      setAiError('Gemini API 키를 먼저 연결해 주세요. 설정에서 키를 넣고 연결 테스트를 하면 바로 생성할 수 있습니다.')
      return
    }
    setAiLoading(true)
    setAiError('')
    reset()
    try {
      const raw = await onGenerate(aiKeyword)
      const outcome = parseScenarioJson(JSON.stringify(raw))
      setErrors(outcome.errors)
      setWarnings(outcome.warnings)
      if (outcome.ok) setPreview(outcome.scenarios)
      else setAiError('AI가 만든 JSON이 형식에 맞지 않습니다. 다시 생성해 보세요.')
    } catch (error) {
      setAiError((error as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  const copyPrompt = async () => {
    const ok = await copyText(CUSTOM_SCENARIO_PROMPT)
    setCopied(ok)
    setTimeout(() => setCopied(false), 2000)
  }

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setJsonText(text)
    const outcome = parseScenarioJson(text)
    setErrors(outcome.errors)
    setWarnings(outcome.warnings)
    setPreview(outcome.ok ? outcome.scenarios : null)
    event.target.value = ''
  }

  const footer = useMemo(
    () => (
      <>
        <span className="muted footer-note">
          {preview ? `${preview.length}개 과제 준비됨` : errors.length ? '오류를 확인하세요' : '미리보기 후 저장'}
        </span>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          취소
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!preview?.length}>
          {editing ? '수정 내용 저장' : '저장하고 이 과제로 연습'}
        </button>
      </>
    ),
    [preview, errors.length, onClose, save, editing],
  )

  return (
    <Sheet
      title={editing ? '내 과제 수정' : '새 과제 추가'}
      subtitle="직접 입력 · JSON 붙여넣기 · Gemini 자동 생성 중 편한 방법을 쓰세요. 저장한 과제는 이 PC에 남습니다."
      onClose={onClose}
      size="lg"
      footer={footer}
    >
      {!editing ? (
        <div className="tabs tabs-add" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'form'} className={`tab ${tab === 'form' ? 'is-active' : ''}`} onClick={() => { setTab('form'); reset() }}>
            ① 직접 입력
          </button>
          <button type="button" role="tab" aria-selected={tab === 'json'} className={`tab ${tab === 'json' ? 'is-active' : ''}`} onClick={() => { setTab('json'); reset() }}>
            ② JSON 붙여넣기
          </button>
          <button type="button" role="tab" aria-selected={tab === 'ai'} className={`tab ${tab === 'ai' ? 'is-active' : ''}`} onClick={() => { setTab('ai'); reset() }}>
            ③ Gemini로 자동 생성
          </button>
        </div>
      ) : null}

      {tab === 'form' ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ns-title">과제 제목 *</label>
            <input id="ns-title" value={form.title} onChange={set('title')} placeholder="예: 신규 세정제 도입 — 피부흡수 물질 관리" />
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="ns-field">분야/태그</label>
              <input id="ns-field" value={form.field} onChange={set('field')} placeholder="보건 / 공통 / 환경" />
            </div>
            <div className="field">
              <label htmlFor="ns-constraints">핵심 조건 (한 줄에 하나)</label>
              <textarea id="ns-constraints" rows={3} value={form.constraints} onChange={set('constraints')} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ns-bg">과제 배경 *</label>
            <textarea id="ns-bg" rows={3} value={form.background} onChange={set('background')} placeholder="상황·일정·제약을 3~5문장으로" />
          </div>
          <div className="field">
            <label htmlFor="ns-mission">미션 *</label>
            <textarea id="ns-mission" rows={2} value={form.mission} onChange={set('mission')} placeholder="3,000자 이내로 ~ 보고서를 작성하시오." />
          </div>

          {([1, 2] as const).map(index => {
            const titleKey = index === 1 ? 'r1Title' : 'r2Title'
            const summaryKey = index === 1 ? 'r1Summary' : 'r2Summary'
            const contentKey = index === 1 ? 'r1Content' : 'r2Content'
            return (
              <fieldset key={index} className="field-group">
                <legend>참고자료 {index}</legend>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor={`ns-r${index}-title`}>제목</label>
                    <input id={`ns-r${index}-title`} value={form[titleKey]} onChange={set(titleKey)} />
                  </div>
                  <div className="field">
                    <label htmlFor={`ns-r${index}-summary`}>한 줄 요약</label>
                    <input id={`ns-r${index}-summary`} value={form[summaryKey]} onChange={set(summaryKey)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={`ns-r${index}-content`}>내용 (마크다운 표 사용 가능: | 항목 | 값 |)</label>
                  <textarea
                    id={`ns-r${index}-content`}
                    rows={7}
                    value={form[contentKey]}
                    onChange={set(contentKey)}
                    placeholder={'본문 문단\n\n| 항목 | 값 |\n| --- | --- |\n| 제어풍속 | 0.32 m/s |\n\n- 주1) 각주'}
                  />
                </div>
              </fieldset>
            )
          })}

          <div className="field">
            <label htmlFor="ns-traps">숨은 함정 (선택 · 채점 체크리스트)</label>
            <textarea
              id="ns-traps"
              rows={3}
              value={form.traps}
              onChange={set('traps')}
              placeholder={'단위 혼재(ppm↔mg/m³) :: 표 2는 mg/m³인데 기준은 ppm이라 환산 없이 비교하면 오판한다.\n측정 항목 누락 :: 신규 물질은 측정 항목에 없어 "자료 없음"이지 노출 없음이 아니다.'}
            />
            <p className="hint">형식: <code>함정 제목 :: 설명</code> (한 줄에 하나). 채점 리포트의 함정 탐지에 쓰입니다.</p>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-dark" onClick={() => validateInput(formToInput(form))}>
              검증하고 미리보기
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'json' ? (
        <div className="form-grid">
          <div className="notice-box">
            <strong>AI에게 문제를 만들어 달라고 할 수 있습니다.</strong> 아래 프롬프트를 복사해 Gemini·ChatGPT에 붙여 넣고 주제를
            적으면, 이 앱에 바로 넣을 수 있는 JSON을 만들어 줍니다.
            <div className="notice-actions">
              <button type="button" className="btn btn-dark btn-sm" onClick={copyPrompt}>
                {copied ? '✓ 복사됨' : '📋 AI 문제 생성 프롬프트 복사'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => downloadTextFile('AI문제생성_프롬프트.txt', CUSTOM_SCENARIO_PROMPT, 'text/plain')}
              >
                ⬇ 프롬프트 파일로 저장
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="ns-json">문제 JSON (단일 객체 · 배열 · 코드펜스 모두 허용)</label>
            <textarea
              id="ns-json"
              rows={12}
              value={jsonText}
              onChange={event => setJsonText(event.target.value)}
              spellCheck={false}
              placeholder={'```json\n{ "title": "...", "background": "...", "mission": "...", "resources": [ ... ], "traps": [ ... ] }\n```'}
            />
          </div>
          <div className="form-actions">
            <input type="file" accept=".json,.txt,application/json" onChange={onFile} className="file-input" aria-label="JSON 파일 선택" />
            <button type="button" className="btn btn-dark" onClick={validateJson} disabled={!jsonText.trim()}>
              검증하고 미리보기
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'ai' ? (
        <div className="form-grid">
          <div className="notice-box">
            연결된 Gemini가 표·수치·함정을 갖춘 새 과제를 만들어 줍니다. 주제를 비워 두면 최근 반도체 EHS 이슈에서 골라
            만듭니다. {apiReady ? '' : <strong>지금은 API 키가 없어 데모로 생성할 수 없습니다.</strong>}
          </div>
          <div className="field">
            <label htmlFor="ns-ai-keyword">주제 키워드 (선택)</label>
            <div className="field-row">
              <input
                id="ns-ai-keyword"
                value={aiKeyword}
                onChange={event => setAiKeyword(event.target.value)}
                placeholder="예: 반도체 클린룸 TMAH 누출 대응 / 신규 설비 위험성평가"
              />
              <button type="button" className="btn btn-dark" onClick={generate} disabled={aiLoading}>
                {aiLoading ? '생성 중…' : '✨ Gemini로 새 과제 1개 만들기'}
              </button>
            </div>
            {!apiReady ? (
              <button type="button" className="link-btn" onClick={onOpenSettings}>
                → Gemini API 키 연결하러 가기
              </button>
            ) : null}
            {aiError ? <p className="status-line is-error">{aiError}</p> : null}
          </div>
        </div>
      ) : null}

      {errors.length ? (
        <div className="error-box">
          <strong>고칠 점이 있습니다</strong>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="warning-box">
          <strong>확인해 주세요</strong>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview?.length ? (
        <div className="preview-wrap">
          <h3 className="sheet-section-title">미리보기</h3>
          <Preview scenarios={preview} />
        </div>
      ) : null}
    </Sheet>
  )
}
