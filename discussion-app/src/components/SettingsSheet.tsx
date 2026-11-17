import { useEffect, useRef, useState } from 'react'
import type { DebateMode, DiscussionStyle, DisplayMode, Pace, Settings } from '../types'
import { errorMessage, KEY_HINT, listModels, modelLabel, pickBestModel, type GeminiModel } from '../logic/gemini'
import { paceLabel } from '../logic/storage'
import { Sheet } from './Sheet'
import { Segment } from './Segment'

type Notice = { kind: 'ok' | 'error' | 'info'; text: string } | null

export function SettingsSheet({
  open,
  onClose,
  settings,
  onChange,
  apiKey,
  onSaveKey,
  onDeleteKey,
  models,
  onModels,
  sessionCount,
  onExport,
  onImportFile,
  onClearHistory,
  onOpenAbout,
}: {
  open: boolean
  onClose: () => void
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  apiKey: string
  onSaveKey: (key: string) => void
  onDeleteKey: () => void
  models: GeminiModel[]
  onModels: (models: GeminiModel[]) => void
  sessionCount: number
  onExport: () => void
  onImportFile: (file: File) => void
  onClearHistory: () => void
  onOpenAbout: () => void
}) {
  const [draft, setDraft] = useState(apiKey)
  const [reveal, setReveal] = useState(false)
  const [testing, setTesting] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setDraft(apiKey)
      setReveal(false)
      setNotice(null)
    }
  }, [open, apiKey])

  const save = (value: string) => {
    setDraft(value)
    onSaveKey(value)
  }

  const test = async () => {
    const key = draft.trim()
    if (!key) {
      setNotice({ kind: 'error', text: 'Gemini API 키를 먼저 붙여넣어 주세요.' })
      return
    }
    onSaveKey(key)
    setTesting(true)
    setNotice({ kind: 'info', text: '키와 모델 목록을 확인하는 중…' })
    try {
      const list = await listModels(key)
      onModels(list)
      const best = pickBestModel(list)
      const currentValid = settings.model && list.some(model => model.id === settings.model)
      if (!currentValid && best) onChange({ model: best })
      setNotice({
        kind: 'ok',
        text: `연결 성공 · 사용할 수 있는 모델 ${list.length}개를 찾았습니다.${
          !currentValid && best ? ` ${best} 모델을 선택했어요.` : ''
        }`,
      })
    } catch (error) {
      onModels([])
      setNotice({ kind: 'error', text: errorMessage(error) })
    } finally {
      setTesting(false)
    }
  }

  const removeKey = () => {
    setDraft('')
    onDeleteKey()
    onModels([])
    setReveal(false)
    setNotice({ kind: 'info', text: '저장된 키를 지웠습니다. 이제 데모 모드로 동작합니다.' })
  }

  return (
    <Sheet open={open} title="설정" subtitle="내 키로 직접 연결합니다" onClose={onClose}>
      <section className="settings-section">
        <div className="section-head">
          <h3>Gemini API 키</h3>
          <a className="text-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            키 발급받기 ↗
          </a>
        </div>
        <div className="key-row">
          <input
            className="text-input key-input"
            type={reveal ? 'text' : 'password'}
            placeholder="AIza로 시작하는 API 키"
            value={draft}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={event => setDraft(event.target.value)}
            onBlur={() => {
              if (draft.trim() !== apiKey) save(draft.trim())
            }}
          />
          <button className="icon-button bordered" onClick={() => setReveal(value => !value)} aria-label={reveal ? '가리기' : '보기'}>
            {reveal ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M10.6 6.2A9.6 9.6 0 0121 12a10.4 10.4 0 01-3 3.5M6.3 7.8A10.6 10.6 0 003 12a9.7 9.7 0 005.2 5.1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M2.8 12S6.5 5.8 12 5.8 21.2 12 21.2 12 17.5 18.2 12 18.2 2.8 12 2.8 12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
          </button>
        </div>
        {draft.trim() && !KEY_HINT.test(draft.trim()) ? (
          <p className="inline-warn">보통 AIza로 시작하는 39자 내외 키입니다. 붙여넣은 값이 잘리지 않았는지 확인해 주세요.</p>
        ) : null}
        <div className="button-row">
          <button className="primary-button small" onClick={test} disabled={testing}>
            {testing ? '확인 중…' : '연결 테스트 & 모델 불러오기'}
          </button>
          <button className="ghost-button bordered" onClick={removeKey} disabled={!draft && !apiKey}>
            키 삭제
          </button>
        </div>
        {notice ? <p className={`notice notice-${notice.kind}`}>{notice.text}</p> : null}
        <p className="fine-print">
          키는 이 브라우저의 localStorage에만 저장되고, 요청은 구글 Gemini API로 바로 전송됩니다. 이 앱에는 서버가
          없어 키가 다른 곳으로 전송되지 않습니다. 공용 기기에서는 사용 후 키를 삭제해 주세요.
        </p>
      </section>

      <section className="settings-section">
        <div className="section-head">
          <h3>모델</h3>
          <span className="section-note">
            {models.length ? `${models.length}개 사용 가능` : '연결 테스트를 하면 목록을 불러옵니다'}
          </span>
        </div>
        <label className="field-block">
          <span className="field-label">사용할 모델</span>
          <select
            className="text-input select"
            value={settings.model ?? ''}
            onChange={event => onChange({ model: event.target.value || null })}
            disabled={!models.length}
          >
            <option value="">{models.length ? '모델을 선택해 주세요' : '먼저 연결 테스트를 해 주세요'}</option>
            {models.map(model => (
              <option key={model.id} value={model.id}>
                {model.displayName !== model.id ? `${model.displayName} (${model.id})` : model.id}
                {model.isPro ? ' · Pro' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="fine-print">
          기본값은 무료 한도가 넉넉한 최신 Flash-Lite 모델입니다. 토의는 발언 요청이 자주 나가서 429(한도 초과)를
          줄이는 편이 좋습니다. Pro 모델은 더 깊지만 느리고 한도를 빨리 씁니다. 현재 {modelLabel(models, settings.model)}.
        </p>
      </section>

      <section className="settings-section">
        <div className="section-head">
          <h3>토의 기본값</h3>
        </div>
        <Segment<DebateMode>
          label="팀원 응답 수"
          hint={settings.debateMode === 'deep' ? '내 발언마다 두 명이 답합니다' : '내 발언마다 한 명이 답합니다'}
          value={settings.debateMode}
          options={[
            { value: 'basic', label: '1명 응답' },
            { value: 'deep', label: '2명 응답' },
          ]}
          onChange={value => onChange({ debateMode: value })}
        />
        <Segment<DisplayMode>
          label="표시 모드"
          hint={settings.displayMode === 'real' ? '이전 AI 발언을 가립니다' : '모든 발언이 보입니다'}
          value={settings.displayMode}
          options={[
            { value: 'normal', label: '일반 모드' },
            { value: 'real', label: '실전 모드' },
          ]}
          onChange={value => onChange({ displayMode: value })}
        />
        <Segment<Pace>
          label="AI 응답 간격"
          hint={`현재 ${paceLabel(settings.pace)}`}
          value={settings.pace}
          options={[
            { value: 'relaxed', label: '여유' },
            { value: 'normal', label: '보통' },
            { value: 'fast', label: '빠름' },
          ]}
          onChange={value => onChange({ pace: value })}
        />
        <Segment<DiscussionStyle>
          label="토의 성향"
          hint={settings.discussionStyle === 'consensus' ? '관점을 조율해 합의안을 만듭니다' : '결론 차이를 더 적극적으로 검토합니다'}
          value={settings.discussionStyle}
          options={[
            { value: 'consensus', label: '합의·조율 토의' },
            { value: 'debate', label: '찬반 집중 토론' },
          ]}
          onChange={value => onChange({ discussionStyle: value })}
        />
        <Segment<'on' | 'off'>
          label="AI 목소리 재생"
          hint={settings.tts ? '민준·서연·도현의 톤을 구분해 읽어 줍니다' : '글자로만 봅니다'}
          value={settings.tts ? 'on' : 'off'}
          options={[
            { value: 'off', label: '끔' },
            { value: 'on', label: '재생' },
          ]}
          onChange={value => onChange({ tts: value === 'on' })}
        />
      </section>

      <section className="settings-section">
        <div className="section-head">
          <h3>기록 백업</h3>
          <span className="section-note">저장된 토의 {sessionCount}개</span>
        </div>
        <div className="button-row">
          <button className="soft-button" onClick={onExport} disabled={!sessionCount}>
            JSON 내보내기
          </button>
          <button className="soft-button" onClick={() => fileRef.current?.click()}>
            JSON 가져오기
          </button>
          <button className="soft-button danger" onClick={onClearHistory} disabled={!sessionCount}>
            전체 삭제
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) onImportFile(file)
            event.target.value = ''
          }}
        />
        <p className="fine-print">기록은 이 브라우저에만 저장됩니다. 브라우저 데이터를 지우면 함께 사라지니 백업해 두세요.</p>
      </section>

      <section className="settings-section">
        <button className="ghost-button full" onClick={onOpenAbout}>
          이 앱에 대하여 · 출처와 라이선스
        </button>
      </section>
    </Sheet>
  )
}
