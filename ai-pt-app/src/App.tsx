import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Attempt,
  ChatMessage,
  FollowUp,
  GradeResult,
  Scenario,
  Settings,
  TimerState,
} from './types'
import { BUILTIN_SCENARIOS } from './data/scenarios'
import { Header } from './components/Header'
import { ProblemPanel } from './components/ProblemPanel'
import { AnswerPanel } from './components/AnswerPanel'
import { ChatPanel } from './components/ChatPanel'
import { ResourceViewer } from './components/ResourceViewer'
import { SettingsSheet, type SettingsStatus } from './components/SettingsSheet'
import { HistorySheet } from './components/HistorySheet'
import { ScenarioPickerSheet } from './components/ScenarioPickerSheet'
import { ModelAnswerSheet } from './components/ModelAnswerSheet'
import { AddScenarioSheet } from './components/AddScenarioSheet'
import { FeedbackScreen } from './components/FeedbackScreen'
import {
  GeminiError,
  errorMessage,
  generateJson,
  generateText,
  listModels,
  pickBestModel,
  type GeminiModel,
} from './logic/gemini'
import {
  GEN_SCENARIO_SCHEMA,
  GRADE_SCHEMA,
  buildAgentContents,
  buildAgentSystem,
  buildGradePrompt,
  buildGradeSystem,
  buildRehearsalPrompt,
  buildScenarioGenSystem,
  buildScenarioGenUser,
} from './logic/prompts'
import { demoGrade, emptyGrade, normalizeGrade } from './logic/grade'
import { classifyPrompt } from './logic/coach'
import { demoRehearsalFeedback, demoReply } from './logic/demo'
import { ANSWER_LIMIT, countChars, formatClock, uid } from './logic/text'
import {
  loadAttempts,
  loadChat,
  loadDraft,
  loadNotes,
  loadSettings,
  loadTimer,
  parseHistoryJson,
  removeAttempt,
  saveAttempts,
  saveChat,
  saveDraft,
  saveNotes,
  saveSettings,
  saveTimer,
  exportHistoryJson,
} from './logic/storage'
import { deleteCustomScenario, exportCustomJson, loadCustomScenarios, upsertCustomScenario } from './logic/customScenario'
import { downloadTextFile } from './logic/clipboard'

type SheetName = 'settings' | 'history' | 'picker' | 'add' | null

type FeedbackView = {
  scenarioId: string
  title: string
  answer: string
  chatTurns: number
  durationSec: number
  autoSubmitted: boolean
  attemptId: string
}

const DEFAULT_TIMER: TimerState = { limit: 35, remaining: 35 * 60, running: false, endAt: null, startedAt: null }

function timerFromSaved(saved: TimerState | null, now = Date.now()): TimerState {
  if (!saved) return { ...DEFAULT_TIMER }
  const limit = saved.limit === 30 ? 30 : 35
  if (saved.running && saved.endAt) {
    const diff = saved.endAt - now
    const remaining = Math.max(0, Math.ceil(diff / 1000))
    // 앱을 닫았다 다시 연 사이에 시간이 끝났다면 자동 제출하지 않고 00:00 정지 상태로 둡니다.
    return {
      limit,
      remaining,
      running: diff > 0,
      endAt: diff > 0 ? saved.endAt : null,
      startedAt: saved.startedAt ?? null,
    }
  }
  return {
    limit,
    remaining: Math.min(Math.max(0, saved.remaining), limit * 60),
    running: false,
    endAt: null,
    startedAt: saved.startedAt ?? null,
  }
}

export default function App() {
  const [customScenarios, setCustomScenarios] = useState<Scenario[]>(() => loadCustomScenarios())
  const scenarios = useMemo(() => [...BUILTIN_SCENARIOS, ...customScenarios], [customScenarios])
  const [activeId, setActiveId] = useState(() => BUILTIN_SCENARIOS[0].id)
  const scenario = useMemo(() => scenarios.find(item => item.id === activeId) ?? BUILTIN_SCENARIOS[0], [scenarios, activeId])

  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [models, setModels] = useState<GeminiModel[]>([])
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus>({ kind: 'idle', message: '' })

  const [draft, setDraft] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [notes, setNotes] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [timer, setTimer] = useState<TimerState>({ ...DEFAULT_TIMER })
  const [savedLabel, setSavedLabel] = useState('자동 저장')

  const [phase, setPhase] = useState<'exam' | 'feedback'>('exam')
  const [view, setView] = useState<FeedbackView | null>(null)
  const [grade, setGrade] = useState<GradeResult | null>(null)
  const [gradeLoading, setGradeLoading] = useState(false)
  const [gradeError, setGradeError] = useState('')
  const [submittingUi, setSubmittingUi] = useState(false)
  const [attempts, setAttempts] = useState<Attempt[]>(() => loadAttempts())

  const [sheet, setSheet] = useState<SheetName>(null)
  const [modelAnswerScenario, setModelAnswerScenario] = useState<Scenario | null>(null)
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null)
  const [resourceIndex, setResourceIndex] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  const apiReady = Boolean(settings.apiKey.trim() && settings.model)
  const autoSubmittedRef = useRef(false)
  const submittingRef = useRef(false)

  const notify = useCallback((message: string) => {
    setToast(message)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(id)
  }, [toast])

  /* ------------------------------ 시나리오 전환: 저장본 불러오기 ------------------------------ */
  // 과제를 바꾸는 순간에는 이전 과제의 상태가 새 과제 키에 저장되지 않도록 잠시 저장을 건너뜁니다.
  const skipSaveRef = useRef(false)
  useEffect(() => {
    skipSaveRef.current = true
    setDraft(loadDraft(scenario.id))
    setChat(loadChat(scenario.id))
    setNotes(loadNotes(scenario.id))
    setTimer(timerFromSaved(loadTimer(scenario.id)))
    setChatInput('')
    autoSubmittedRef.current = false
    const id = setTimeout(() => {
      skipSaveRef.current = false
    }, 0)
    return () => clearTimeout(id)
  }, [scenario.id])

  const selectScenario = useCallback((id: string) => {
    setActiveId(id)
    setPhase('exam')
    setView(null)
    setGrade(null)
    setGradeError('')
    setSheet(null)
    setModelAnswerScenario(null)
  }, [])

  /* ------------------------------ 자동 저장 ------------------------------ */
  useEffect(() => {
    const id = setTimeout(() => {
      saveDraft(scenario.id, draft)
      if (draft) {
        const now = new Date()
        setSavedLabel(`자동 저장 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      } else {
        setSavedLabel('자동 저장')
      }
    }, 500)
    return () => clearTimeout(id)
  }, [draft, scenario.id])

  useEffect(() => {
    if (skipSaveRef.current) return
    saveChat(scenario.id, chat)
  }, [chat, scenario.id])

  useEffect(() => {
    if (skipSaveRef.current) return
    saveNotes(scenario.id, notes)
  }, [notes, scenario.id])

  useEffect(() => {
    if (skipSaveRef.current) return
    saveTimer(scenario.id, timer)
  }, [timer, scenario.id])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  /* ------------------------------ 타이머 ------------------------------ */
  const submitRef = useRef<(auto: boolean) => Promise<void>>(async () => {})

  useEffect(() => {
    if (!timer.running || !timer.endAt) return
    const tick = () => {
      const remaining = Math.max(0, Math.round((timer.endAt! - Date.now()) / 1000))
      setTimer(prev => (prev.remaining === remaining ? prev : { ...prev, remaining }))
      if (remaining <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true
        setTimer(prev => ({ ...prev, running: false, endAt: null, remaining: 0 }))
        void submitRef.current(true)
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [timer.running, timer.endAt])

  const toggleTimer = () => {
    setTimer(prev => {
      if (prev.running) {
        const remaining = prev.endAt ? Math.max(0, Math.round((prev.endAt - Date.now()) / 1000)) : prev.remaining
        return { ...prev, running: false, remaining, endAt: null }
      }
      const remaining = prev.remaining <= 0 ? prev.limit * 60 : prev.remaining
      return { ...prev, running: true, remaining, endAt: Date.now() + remaining * 1000, startedAt: prev.startedAt ?? Date.now() }
    })
  }

  const resetTimer = () => {
    autoSubmittedRef.current = false
    setTimer({ limit: timer.limit, remaining: timer.limit * 60, running: false, endAt: null, startedAt: null })
    notify('타이머를 초기화했습니다.')
  }

  const changeLimit = (minutes: number) => {
    const limit = minutes === 30 ? 30 : 35
    autoSubmittedRef.current = false
    setTimer({ limit, remaining: limit * 60, running: false, endAt: null, startedAt: null })
  }

  /* ------------------------------ 채팅 ------------------------------ */
  const sendChat = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    const verdict = classifyPrompt(text)
    const userMessage: ChatMessage = { id: uid('msg'), role: 'user', text, at: Date.now() }
    const history = [...chat, userMessage]
    setChat(history)
    setChatInput('')
    setChatLoading(true)
    const coachTip = settings.coachOn && verdict.kind === 'broad' ? verdict.tip : undefined

    try {
      if (!apiReady) {
        await delay(500)
        const reply: ChatMessage = {
          id: uid('msg'),
          role: 'ai',
          text: demoReply(scenario, text),
          at: Date.now(),
          demo: true,
          coachTip,
        }
        setChat(prev => [...prev, reply])
      } else {
        const answer = await generateText({
          key: settings.apiKey,
          model: settings.model!,
          system: buildAgentSystem(scenario),
          contents: buildAgentContents(history),
          temperature: 0.9,
          maxOutputTokens: 2048,
        })
        const reply: ChatMessage = { id: uid('msg'), role: 'ai', text: answer, at: Date.now(), coachTip }
        setChat(prev => [...prev, reply])
      }
    } catch (error) {
      const message =
        error instanceof GeminiError && error.code === 'QUOTA'
          ? '무료 한도를 다 썼습니다. 설정에서 Flash-Lite 모델로 바꾸거나 1분 뒤 다시 시도해 주세요.'
          : errorMessage(error)
      const reply: ChatMessage = {
        id: uid('msg'),
        role: 'ai',
        text: `응답을 받지 못했습니다. ${message}`,
        at: Date.now(),
        error: true,
        coachTip,
      }
      setChat(prev => [...prev, reply])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chat, chatLoading, settings, apiReady, scenario])

  /* ------------------------------ 채점 ------------------------------ */
  const submit = useCallback(
    async (auto: boolean) => {
      if (submittingRef.current) return
      const chars = countChars(draft)
      if (!auto && chars > ANSWER_LIMIT) {
        notify('3,000자를 초과했습니다. 조금 줄인 뒤 제출해 주세요.')
        return
      }
      if (!auto && !draft.trim()) {
        notify('답안을 먼저 작성해 주세요.')
        return
      }
      submittingRef.current = true
      setSubmittingUi(true)
      const remainingAtSubmit = timer.remaining
      const durationSec = Math.max(0, timer.limit * 60 - remainingAtSubmit)
      setTimer(prev => ({ ...prev, running: false, endAt: null }))
      setGradeLoading(true)
      setGrade(null)
      setGradeError('')
      const attemptId = uid('attempt')
      setView({
        scenarioId: scenario.id,
        title: scenario.title,
        answer: draft,
        chatTurns: chat.filter(message => message.role === 'user').length,
        durationSec,
        autoSubmitted: auto,
        attemptId,
      })
      setPhase('feedback')

      let result: GradeResult
      if (apiReady) {
        try {
          const raw = await generateJson<unknown>({
            key: settings.apiKey,
            model: settings.model!,
            system: buildGradeSystem(),
            contents: [{ role: 'user', parts: [{ text: buildGradePrompt(scenario, draft, chat) }] }],
            schema: GRADE_SCHEMA,
            temperature: 0.25,
            maxOutputTokens: 8192,
          })
          result = { ...normalizeGrade(raw, scenario, draft, chat), model: settings.model ?? undefined, at: Date.now() }
        } catch (error) {
          result = demoGrade(scenario, draft, chat)
          setGradeError(`Gemini 채점에 실패해 로컬 채점으로 대체했습니다. (${errorMessage(error)})`)
        }
      } else {
        result = demoGrade(scenario, draft, chat)
      }

      setGrade(result)
      setGradeLoading(false)
      setSubmittingUi(false)
      submittingRef.current = false

      const attempt: Attempt = {
        id: attemptId,
        at: Date.now(),
        scenarioId: scenario.id,
        scenarioCode: scenario.code,
        scenarioTitle: scenario.title,
        field: scenario.field,
        score: result.total,
        answerLength: chars,
        chatTurns: chat.filter(message => message.role === 'user').length,
        durationSec,
        autoSubmitted: auto,
        grade: result,
        answer: draft,
        chat,
      }
      setAttempts(prev => {
        const next = [attempt, ...prev].slice(0, 60)
        saveAttempts(next)
        return next
      })
    },
    [draft, timer.remaining, timer.limit, scenario, chat, apiReady, settings.apiKey, settings.model, notify],
  )

  submitRef.current = submit

  /* ------------------------------ 꼬리질문 리허설 ------------------------------ */
  const handleRehearsal = useCallback(
    async (followUp: FollowUp, defense: string): Promise<string[]> => {
      const target = view ? scenarios.find(item => item.id === view.scenarioId) ?? null : scenario
      let lines: string[]
      if (apiReady && target) {
        const { system, user } = buildRehearsalPrompt(target, followUp, defense)
        const text = await generateText({
          key: settings.apiKey,
          model: settings.model!,
          system,
          contents: [{ role: 'user', parts: [{ text: user }] }],
          temperature: 0.4,
          maxOutputTokens: 500,
        })
        lines = text
          .split(/\n+/)
          .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
          .filter(Boolean)
          .slice(0, 3)
      } else {
        await delay(350)
        lines = demoRehearsalFeedback(followUp.question, defense)
      }

      setGrade(prev => {
        if (!prev) return prev
        const next: GradeResult = {
          ...prev,
          followUps: prev.followUps.map(item =>
            item.question === followUp.question ? { ...item, rehearsal: defense, rehearsalFeedback: lines } : item,
          ),
        }
        if (view?.attemptId) {
          setAttempts(current => {
            const updated = current.map(attempt => (attempt.id === view.attemptId ? { ...attempt, grade: next } : attempt))
            saveAttempts(updated)
            return updated
          })
        }
        return next
      })
      return lines
    },
    [view, scenarios, scenario, apiReady, settings.apiKey, settings.model],
  )

  /* ------------------------------ 설정 ------------------------------ */
  const testConnection = async () => {
    if (!settings.apiKey.trim()) {
      setSettingsStatus({ kind: 'error', message: 'API 키를 먼저 입력해 주세요.' })
      return
    }
    setSettingsStatus({ kind: 'loading', message: '키와 모델 목록을 확인하는 중…' })
    try {
      const list = await listModels(settings.apiKey)
      setModels(list)
      const picked =
        settings.model && list.some(model => model.id === settings.model) ? settings.model : pickBestModel(list)
      setSettings({
        ...settings,
        model: picked,
        coachOn: settings.coachOn,
      })
      setSettingsStatus({
        kind: 'ok',
        message: `연결 성공 · 사용 가능한 모델 ${list.length}개. ${picked ? `권장 모델 ${picked}로 설정했습니다.` : ''}`,
      })
    } catch (error) {
      const message = error instanceof GeminiError && error.code === 'NETWORK'
        ? 'Gemini에 연결하지 못했습니다. 네트워크 또는 브라우저 확장 프로그램(광고 차단)을 확인해 주세요.'
        : errorMessage(error)
      setSettingsStatus({ kind: 'error', message })
    }
  }

  /* ------------------------------ 과제 관리 ------------------------------ */
  const handleSaveScenarios = (list: Scenario[]) => {
    let next = customScenarios
    for (const item of list) next = upsertCustomScenario(item)
    setCustomScenarios(next)
    setEditingScenario(null)
    selectScenario(list[0].id)
    notify(`"${list[0].title}" 과제를 저장했습니다. 바로 연습할 수 있어요.`)
  }

  const handleDeleteScenario = (id: string) => {
    const target = customScenarios.find(item => item.id === id)
    const ok = typeof window.confirm === 'function' ? window.confirm(`"${target?.title ?? '과제'}"를 삭제할까요?`) : true
    if (!ok) return
    const next = deleteCustomScenario(id)
    setCustomScenarios(next)
    if (activeId === id) setActiveId(BUILTIN_SCENARIOS[0].id)
    notify('과제를 삭제했습니다.')
  }

  const generateScenario = async (keyword: string): Promise<unknown> => {
    if (!apiReady) throw new Error('Gemini API 키를 먼저 연결해 주세요.')
    return generateJson<unknown>({
      key: settings.apiKey,
      model: settings.model!,
      system: buildScenarioGenSystem(),
      contents: [{ role: 'user', parts: [{ text: buildScenarioGenUser(keyword) }] }],
      schema: GEN_SCENARIO_SCHEMA,
      temperature: 1,
      maxOutputTokens: 8192,
    })
  }

  const handleExportCustom = () => {
    if (!customScenarios.length) {
      notify('내보낼 과제가 없습니다.')
      return
    }
    downloadTextFile('내_PT과제_백업.json', exportCustomJson(customScenarios))
    notify('내 과제 JSON을 내려받았습니다.')
  }

  const handleExportHistory = () => {
    downloadTextFile('AI문제해결PT_연습기록.json', exportHistoryJson(attempts))
  }

  const handleImportHistory = (raw: string): { ok: boolean; message: string } => {
    const parsed = parseHistoryJson(raw)
    if (!parsed.ok) return { ok: false, message: parsed.error ?? '불러오지 못했습니다.' }
    const merged = [...parsed.attempts, ...attempts.filter(item => !parsed.attempts.some(other => other.id === item.id))]
    const sorted = merged.sort((a, b) => b.at - a.at).slice(0, 60)
    setAttempts(sorted)
    saveAttempts(sorted)
    return { ok: true, message: `기록 ${parsed.attempts.length}개를 불러왔습니다.` }
  }

  const openAttempt = (attempt: Attempt) => {
    const target = scenarios.find(item => item.id === attempt.scenarioId)
    if (target) setActiveId(target.id)
    setGrade(attempt.grade)
    setView({
      scenarioId: attempt.scenarioId,
      title: attempt.scenarioTitle,
      answer: attempt.answer ?? '',
      chatTurns: attempt.chatTurns,
      durationSec: attempt.durationSec,
      autoSubmitted: Boolean(attempt.autoSubmitted),
      attemptId: attempt.id,
    })
    setGradeError('')
    setGradeLoading(false)
    setPhase('feedback')
    setSheet(null)
  }

  const retrySame = () => {
    setPhase('exam')
    setView(null)
    setGrade(null)
    setGradeError('')
    autoSubmittedRef.current = false
    setTimer(prev => ({ ...prev, remaining: prev.limit * 60, running: false, endAt: null, startedAt: null }))
    notify('타이머를 새로 시작할 수 있습니다. 이전 답안은 그대로 남아 있어요.')
  }

  /* ------------------------------ 렌더 ------------------------------ */
  const feedbackScenario = view ? scenarios.find(item => item.id === view.scenarioId) ?? null : scenario

  return (
    <div className="app-shell">
      <Header
        scenario={scenario}
        remaining={timer.remaining}
        running={timer.running}
        limit={timer.limit}
        onToggleTimer={toggleTimer}
        onResetTimer={resetTimer}
        onChangeLimit={changeLimit}
        onOpenPicker={() => setSheet('picker')}
        onOpenSettings={() => setSheet('settings')}
        onOpenHistory={() => setSheet('history')}
        onSubmit={() => void submit(false)}
        apiReady={apiReady}
        submitting={submittingUi}
      />

      {phase === 'exam' ? (
        <main className="workspace">
          <ProblemPanel scenario={scenario} onOpenResource={index => setResourceIndex(index)} />
          <AnswerPanel
            value={draft}
            onChange={setDraft}
            notes={notes}
            onNotesChange={setNotes}
            remaining={timer.remaining}
            timed={Boolean(timer.startedAt)}
            savedLabel={savedLabel}
            onSubmit={() => void submit(false)}
            submitting={submittingUi}
          />
          <ChatPanel
            scenario={scenario}
            chat={chat}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={() => void sendChat()}
            loading={chatLoading}
            coachOn={settings.coachOn}
            onToggleCoach={value => setSettings({ ...settings, coachOn: value })}
            demoMode={!apiReady}
          />
        </main>
      ) : (
        <main className="feedback-wrap">
          <FeedbackScreen
            scenario={feedbackScenario}
            fallbackTitle={view?.title ?? scenario.title}
            grade={grade ?? emptyGrade(feedbackScenario ?? scenario)}
            answer={view?.answer ?? draft}
            chatTurns={view?.chatTurns ?? 0}
            durationSec={view?.durationSec ?? 0}
            loading={gradeLoading}
            error={gradeError}
            autoSubmitted={Boolean(view?.autoSubmitted)}
            onRetry={retrySame}
            onOpenPicker={() => setSheet('picker')}
            onOpenHistory={() => setSheet('history')}
            onRehearsal={handleRehearsal}
          />
        </main>
      )}

      {sheet === 'settings' ? (
        <SettingsSheet
          settings={settings}
          models={models}
          status={settingsStatus}
          onChangeKey={key => setSettings({ ...settings, apiKey: key })}
          onChangeModel={model => setSettings({ ...settings, model })}
          onTest={() => void testConnection()}
          onClearKey={() => {
            setSettings({ ...settings, apiKey: '', model: null })
            setModels([])
            setSettingsStatus({ kind: 'idle', message: '' })
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'history' ? (
        <HistorySheet
          attempts={attempts}
          onClose={() => setSheet(null)}
          onOpen={openAttempt}
          onDelete={id => {
            setAttempts(removeAttempt(id))
          }}
          onExport={handleExportHistory}
          onImport={handleImportHistory}
        />
      ) : null}

      {sheet === 'picker' ? (
        <ScenarioPickerSheet
          scenarios={scenarios}
          activeId={activeId}
          customCount={customScenarios.length}
          onSelect={id => {
            selectScenario(id)
          }}
          onClose={() => setSheet(null)}
          onAdd={() => {
            setEditingScenario(null)
            setSheet('add')
          }}
          onEdit={item => {
            setEditingScenario(item)
            setSheet('add')
          }}
          onDelete={handleDeleteScenario}
          onExportCustom={handleExportCustom}
          onOpenModelAnswer={item => setModelAnswerScenario(item)}
        />
      ) : null}

      {modelAnswerScenario ? (
        <ModelAnswerSheet scenario={modelAnswerScenario} onClose={() => setModelAnswerScenario(null)} />
      ) : null}

      {sheet === 'add' ? (
        <AddScenarioSheet
          onClose={() => {
            setSheet(null)
            setEditingScenario(null)
          }}
          onSave={handleSaveScenarios}
          editing={editingScenario}
          apiReady={apiReady}
          onOpenSettings={() => setSheet('settings')}
          onGenerate={generateScenario}
        />
      ) : null}

      {resourceIndex !== null ? (
        <ResourceViewer
          scenario={scenario}
          initialIndex={resourceIndex}
          onClose={() => setResourceIndex(null)}
          onInsertSummary={text => {
            setChatInput(text)
            notify('채팅 입력창에 자료 요약을 넣었습니다. 질문을 덧붙여 보내세요.')
          }}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      <footer className="app-foot">
        <span>
          비공식 연습 도구 · SK하이닉스와 무관합니다 · 남은 시간 {formatClock(timer.remaining)} · 답안 {countChars(draft)}
          자
        </span>
        <span>API 키와 기록은 이 PC 브라우저에만 저장됩니다.</span>
      </footer>
    </div>
  )
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
