import { useCallback, useEffect, useRef, useState } from 'react'
import type { DebateTopic, Feedback, FollowUp, SavedSession, Settings } from './types'
import { practiceTopics } from './data/topics'
import { useDebate } from './hooks/useDebate'
import { errorMessage, generateJson, listModels, pickBestModel, type GeminiModel } from './logic/gemini'
import { demoFeedback, normalizeFeedback, normalizeFollowUps, type RawFeedback } from './logic/feedback'
import {
  buildDraftContext,
  buildDraftSystem,
  buildFeedbackContext,
  buildRehearsalContext,
  buildRehearsalSystem,
  buildReviewContext,
  buildReviewSystem,
  draftSchema,
  feedbackSchema,
  feedbackSystem,
  rehearsalSchema,
  reviewSchema,
} from './logic/prompts'
import { demoDraft, demoRehearsal, demoReview, normalizeLines } from './logic/discussion'
import { deliverableHasContent } from './logic/stages'
import {
  exportSessions,
  loadApiKey,
  loadSessions,
  loadSettings,
  makeSessionId,
  mergeSessions,
  parseImportedSessions,
  removeSession,
  saveApiKey,
  saveSessions,
  saveSettings,
  upsertSession,
  clearApiKey,
} from './logic/storage'
import { SetupScreen } from './components/SetupScreen'
import { DebateScreen } from './components/DebateScreen'
import { FeedbackScreen } from './components/FeedbackScreen'
import { HistoryScreen } from './components/HistoryScreen'
import { TopicSheet } from './components/TopicSheet'
import { CustomTopicSheet } from './components/CustomTopicSheet'
import { SettingsSheet } from './components/SettingsSheet'
import { AboutSheet } from './components/AboutSheet'
import { ModelGuideSheet } from './components/ModelGuideSheet'

type View = 'setup' | 'debate' | 'feedback' | 'history'
type SheetKind = 'topic' | 'custom' | 'settings' | 'about' | null
type AiBusy = 'draft' | 'review' | null

const topicFromSession = (session: SavedSession): DebateTopic => ({
  id: session.topicId,
  title: session.topicTitle,
  category: session.category,
  source: 'prepared',
  ...(session.topicContext ? { context: session.topicContext } : {}),
  ...(session.additionalPerspective ? { additionalPerspective: session.additionalPerspective } : {}),
})

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [apiKey, setApiKey] = useState(() => loadApiKey())
  const [models, setModels] = useState<GeminiModel[]>([])
  const [topic, setTopic] = useState<DebateTopic | null>(null)
  const [view, setView] = useState<View>('setup')
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [guideTopic, setGuideTopic] = useState<DebateTopic | null>(null)
  const [sessions, setSessions] = useState<SavedSession[]>(() => loadSessions())
  const [selectedSession, setSelectedSession] = useState<SavedSession | null>(null)
  const [activeSession, setActiveSession] = useState<SavedSession | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [fbLoading, setFbLoading] = useState(false)
  const [fbError, setFbError] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState<AiBusy>(null)
  const [reviewLines, setReviewLines] = useState<string[]>([])
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [draftProposal, setDraftProposal] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const finishRef = useRef<() => void>(() => {})
  const engine = useDebate({
    topic,
    settings,
    apiKey,
    model: settings.model,
    onAutoEnd: () => finishRef.current(),
  })

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  // 저장된 키가 있는데 모델이 비어 있으면 조용히 모델 목록을 불러와 가장 좋은 Flash-Lite를 고릅니다.
  useEffect(() => {
    if (!apiKey.trim() || settings.model) return
    let cancelled = false
    void (async () => {
      try {
        const list = await listModels(apiKey)
        if (cancelled) return
        setModels(list)
        const best = pickBestModel(list)
        if (best) updateSettings({ model: best })
      } catch {
        /* 설정 화면에서 직접 연결 테스트를 할 수 있습니다. */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(previous => ({ ...previous, ...patch }))
  }, [])

  const handleSaveKey = useCallback((key: string) => {
    setApiKey(key)
    saveApiKey(key)
  }, [])

  const handleDeleteKey = useCallback(() => {
    clearApiKey()
    setApiKey('')
    setModels([])
    setSettings(previous => ({ ...previous, model: null }))
  }, [])

  const startDebate = useCallback(() => {
    if (!topic) return
    setFeedback(null)
    setFbError(null)
    setActiveSession(null)
    setReviewLines([])
    setDraftNotice(null)
    setDraftProposal(null)
    setView('debate')
    engine.reset()
    engine.begin()
  }, [engine, topic])

  const requestFeedback = useCallback(
    async (session: SavedSession) => {
      setFbLoading(true)
      setFbError(null)
      const sessionTopic = topicFromSession(session)
      try {
        let result: Feedback
        if (!apiKey.trim()) {
          result = demoFeedback({
            messages: session.messages,
            topic: sessionTopic,
            prepNotes: session.prepNotes,
            jointDeliverable: session.jointDeliverable,
          })
        } else {
          if (!settings.model) {
            throw new Error('사용할 모델이 없어요. 설정에서 "연결 테스트 & 모델 불러오기"를 먼저 실행해 주세요.')
          }
          const raw = await generateJson<RawFeedback>({
            key: apiKey,
            model: settings.model,
            system: feedbackSystem(),
            contents: buildFeedbackContext({
              topic: sessionTopic,
              messages: session.messages,
              prepNotes: session.prepNotes,
              jointDeliverable: session.jointDeliverable,
              style: session.discussionStyle,
            }),
            schema: feedbackSchema,
            temperature: 0.7,
            maxOutputTokens: 4096,
          })
          result = normalizeFeedback(raw)
          if (!result.followUps?.length) {
            result.followUps = normalizeFollowUps([], demoFeedback({ messages: session.messages, topic: sessionTopic }).followUps)
          }
        }
        setFeedback(result)
        setSessions(previous => {
          const next = previous.map(item => (item.id === session.id ? { ...item, feedback: result } : item))
          saveSessions(next)
          return next
        })
        setActiveSession(current => (current ? { ...current, feedback: result } : current))
      } catch (error) {
        setFbError(errorMessage(error))
      } finally {
        setFbLoading(false)
      }
    },
    [apiKey, settings],
  )

  const finishDebate = useCallback(() => {
    if (!topic) {
      setView('setup')
      return
    }
    const messages = engine.end()
    const deliverable = deliverableHasContent(engine.jointDeliverable) ? engine.jointDeliverable.trim() : ''
    if (!messages.some(message => message.speakerId === 'user') && !deliverable) {
      setView('setup')
      setToast('내 발언도 공동 결과물도 없어 기록을 저장하지 않았어요.')
      return
    }
    const hasPrep = Object.values(engine.prepNotes).some(value => value.trim())
    const session: SavedSession = {
      id: makeSessionId(),
      topicId: topic.id,
      topicTitle: topic.title,
      ...(topic.context ? { topicContext: topic.context } : {}),
      category: topic.category,
      mode: settings.debateMode,
      model: settings.model,
      startedAt: engine.startedAt ?? Date.now(),
      endedAt: Date.now(),
      messages,
      feedback: null,
      ...(hasPrep ? { prepNotes: engine.prepNotes } : {}),
      ...(topic.additionalPerspective ? { additionalPerspective: topic.additionalPerspective } : {}),
      ...(deliverable ? { jointDeliverable: deliverable } : {}),
      discussionStyle: settings.discussionStyle,
    }
    setSessions(previous => upsertSession(previous, session))
    setActiveSession(session)
    setSelectedSession(null)
    setFeedback(null)
    setFbLoading(false)
    setView('feedback')
    void requestFeedback(session)
  }, [engine, requestFeedback, settings.debateMode, settings.discussionStyle, settings.model, topic])

  useEffect(() => {
    finishRef.current = finishDebate
  }, [finishDebate])

  /* ------------------------------------------------ 4단계 AI 협업 */

  const handleDraft = useCallback(async () => {
    if (!topic || aiBusy) return
    setAiBusy('draft')
    setDraftNotice(null)
    try {
      let draft: string
      if (!apiKey.trim()) {
        draft = demoDraft({ topic, messages: engine.messages, prepNotes: engine.prepNotes })
        setDraftNotice('데모 초안을 만들었습니다. 아래에서 에디터에 반영할 수 있어요.')
      } else {
        if (!settings.model) throw new Error('사용할 모델이 없어요. 설정에서 모델을 먼저 불러와 주세요.')
        const raw = await generateJson<{ draft?: string }>({
          key: apiKey,
          model: settings.model,
          system: buildDraftSystem(),
          contents: buildDraftContext({
            topic,
            messages: engine.messages,
            prepNotes: engine.prepNotes,
            current: engine.jointDeliverable,
          }),
          schema: draftSchema,
          temperature: 0.8,
          maxOutputTokens: 2048,
        })
        draft = (raw?.draft ?? '').trim()
        if (!draft) throw new Error('초안이 비어 있었어요. 다시 시도해 주세요.')
        setDraftNotice('팀원이 초안을 제안했습니다. 아래에서 확인하고 에디터에 반영하세요.')
      }
      setDraftProposal(draft)
    } catch (error) {
      setDraftNotice(errorMessage(error))
    } finally {
      setAiBusy(null)
    }
  }, [aiBusy, apiKey, engine, settings.model, topic])

  const handleReview = useCallback(async () => {
    if (!topic || aiBusy) return
    const draft = engine.jointDeliverable.trim()
    if (!draft) return
    setAiBusy('review')
    setReviewLines([])
    try {
      if (!apiKey.trim()) {
        setReviewLines(demoReview({ topic, draft }))
      } else {
        if (!settings.model) throw new Error('사용할 모델이 없어요. 설정에서 모델을 먼저 불러와 주세요.')
        const raw = await generateJson<{ lines?: string[] }>({
          key: apiKey,
          model: settings.model,
          system: buildReviewSystem(),
          contents: buildReviewContext({ topic, messages: engine.messages, draft }),
          schema: reviewSchema,
          temperature: 0.6,
          maxOutputTokens: 1024,
        })
        setReviewLines(normalizeLines(raw?.lines, demoReview({ topic, draft })))
      }
    } catch (error) {
      setDraftNotice(errorMessage(error))
    } finally {
      setAiBusy(null)
    }
  }, [aiBusy, apiKey, engine, settings.model, topic])

  const applyProposal = useCallback(() => {
    if (!draftProposal) return
    engine.setJointDeliverable(draftProposal)
    setDraftProposal(null)
    setDraftNotice('초안을 에디터에 반영했습니다. 문장을 다듬어 확정하세요.')
  }, [draftProposal, engine])

  /* ------------------------------------------------ 꼬리질문 리허설 */

  const rehearse = useCallback(
    async (followUp: FollowUp, defense: string): Promise<string[]> => {
      const targetTopic = activeSession ? topicFromSession(activeSession) : topic
      if (!targetTopic) throw new Error('주제 정보를 찾지 못했어요.')
      let lines: string[]
      if (!apiKey.trim()) {
        lines = demoRehearsal({ followUp, defense })
      } else {
        if (!settings.model) throw new Error('사용할 모델이 없어요. 설정에서 모델을 먼저 불러와 주세요.')
        const raw = await generateJson<{ lines?: string[] }>({
          key: apiKey,
          model: settings.model,
          system: buildRehearsalSystem(),
          contents: buildRehearsalContext({
            topic: targetTopic,
            followUp,
            defense,
            jointDeliverable: activeSession?.jointDeliverable ?? engine.jointDeliverable,
          }),
          schema: rehearsalSchema,
          temperature: 0.7,
          maxOutputTokens: 1024,
        })
        lines = normalizeLines(raw?.lines, demoRehearsal({ followUp, defense }))
      }
      setFeedback(previous =>
        previous
          ? {
              ...previous,
              followUps: previous.followUps?.map(item =>
                item.question === followUp.question ? { ...item, defense, coaching: lines } : item,
              ),
            }
          : previous,
      )
      setSessions(previous => {
        const next = previous.map(item =>
          item.id === activeSession?.id && item.feedback
            ? {
                ...item,
                feedback: {
                  ...item.feedback,
                  followUps: item.feedback.followUps?.map(fu =>
                    fu.question === followUp.question ? { ...fu, defense, coaching: lines } : fu,
                  ),
                },
              }
            : item,
        )
        saveSessions(next)
        return next
      })
      return lines
    },
    [activeSession, apiKey, engine.jointDeliverable, settings.model, topic],
  )

  const retryFeedback = useCallback(() => {
    if (activeSession) void requestFeedback(activeSession)
  }, [activeSession, requestFeedback])

  const exitDebate = useCallback(() => {
    if (engine.messages.length && !engine.ended) {
      const ok = window.confirm('토의를 나가면 이번 기록은 저장되지 않아요. 나갈까요?')
      if (!ok) return
    }
    engine.reset()
    setView('setup')
  }, [engine])

  const restartSameTopic = useCallback(() => {
    setFeedback(null)
    setFbError(null)
    setActiveSession(null)
    setReviewLines([])
    setDraftNotice(null)
    setDraftProposal(null)
    setView('debate')
    engine.reset()
    engine.begin()
  }, [engine])

  const randomTopic = useCallback(() => {
    const pool = practiceTopics.filter(item => item.id !== topic?.id)
    setTopic(pool[Math.floor(Math.random() * pool.length)] ?? practiceTopics[0])
  }, [topic])

  const handleExport = useCallback(() => {
    if (!sessions.length) return
    exportSessions(sessions)
    setToast('기록 백업 파일을 내려받았어요.')
  }, [sessions])

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const incoming = parseImportedSessions(text)
        const result = mergeSessions(sessions, incoming)
        setSessions(result.sessions)
        setToast(`기록 ${result.added}개를 추가했어요.${result.updated ? ` ${result.updated}개는 최신 내용으로 갱신했어요.` : ''}`)
      } catch (error) {
        setToast(`가져오지 못했어요. ${errorMessage(error)}`)
      }
    },
    [sessions],
  )

  const handleClearHistory = useCallback(() => {
    if (!sessions.length) return
    const ok = window.confirm(`저장된 토의 ${sessions.length}개를 모두 지울까요? 되돌릴 수 없어요.`)
    if (!ok) return
    saveSessions([])
    setSessions([])
    setToast('모든 기록을 지웠어요.')
  }, [sessions])

  const handleDeleteSession = useCallback((id: string) => {
    const ok = window.confirm('이 기록을 지울까요?')
    if (!ok) return
    setSessions(previous => removeSession(previous, id))
    setSelectedSession(null)
    setToast('기록을 지웠어요.')
  }, [])

  return (
    <div className="app">
      {view === 'setup' ? (
        <SetupScreen
          topic={topic}
          settings={settings}
          apiKey={apiKey}
          models={models}
          onRandom={randomTopic}
          onOpenTopic={() => setSheet('topic')}
          onOpenCustom={() => setSheet('custom')}
          onOpenSettings={() => setSheet('settings')}
          onOpenHistory={() => {
            setSelectedSession(null)
            setView('history')
          }}
          onOpenGuide={() => setGuideTopic(topic)}
          onChange={updateSettings}
          onStart={startDebate}
        />
      ) : null}

      {view === 'debate' && topic ? (
        <DebateScreen
          topic={topic}
          settings={settings}
          engine={engine}
          onChange={updateSettings}
          onEnd={finishDebate}
          onExit={exitDebate}
          onOpenSettings={() => setSheet('settings')}
          onOpenGuide={() => setGuideTopic(topic)}
          onDraft={handleDraft}
          onReview={handleReview}
          aiBusy={aiBusy}
          reviewLines={reviewLines}
          draftNotice={draftNotice}
          draftProposal={draftProposal}
          onApplyProposal={applyProposal}
          onDismissProposal={() => setDraftProposal(null)}
        />
      ) : null}

      {view === 'feedback' && topic ? (
        <FeedbackScreen
          topic={topic}
          messages={activeSession?.messages ?? engine.messages}
          feedback={feedback}
          loading={fbLoading}
          error={fbError}
          prepNotes={activeSession?.prepNotes}
          jointDeliverable={activeSession?.jointDeliverable}
          onRetry={retryFeedback}
          onRestart={restartSameTopic}
          onNewTopic={() => setView('setup')}
          onOpenHistory={() => {
            setSelectedSession(null)
            setView('history')
          }}
          onOpenSettings={() => setSheet('settings')}
          onOpenGuide={() => setGuideTopic(topic)}
          onRehearsal={rehearse}
        />
      ) : null}

      {view === 'history' ? (
        <HistoryScreen
          sessions={sessions}
          selected={selectedSession}
          onOpen={setSelectedSession}
          onBack={() => setSelectedSession(null)}
          onDelete={handleDeleteSession}
          onExport={handleExport}
          onImportFile={handleImport}
          onHome={() => {
            setSelectedSession(null)
            setView('setup')
          }}
        />
      ) : null}

      <TopicSheet
        open={sheet === 'topic'}
        currentId={topic?.id}
        onClose={() => setSheet(null)}
        onSelect={next => {
          setTopic(next)
          setSheet(null)
        }}
        onOpenGuide={next => setGuideTopic(next)}
      />
      <CustomTopicSheet
        open={sheet === 'custom'}
        onClose={() => setSheet(null)}
        onCreate={next => {
          setTopic(next)
          setSheet(null)
        }}
      />
      <SettingsSheet
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
        settings={settings}
        onChange={updateSettings}
        apiKey={apiKey}
        onSaveKey={handleSaveKey}
        onDeleteKey={handleDeleteKey}
        models={models}
        onModels={setModels}
        sessionCount={sessions.length}
        onExport={handleExport}
        onImportFile={handleImport}
        onClearHistory={handleClearHistory}
        onOpenAbout={() => setSheet('about')}
      />
      <AboutSheet open={sheet === 'about'} onClose={() => setSheet(null)} />
      <ModelGuideSheet open={!!guideTopic} topic={guideTopic} onClose={() => setGuideTopic(null)} />

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
