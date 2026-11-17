import { useCallback, useEffect, useRef, useState } from 'react'
import type { AIId, DebateTopic, Message, PrepNotes, Settings, Stage } from '../types'
import { emptyPrepNotes } from '../types'
import { aiIds, nameOf } from '../data/participants'
import { demoReply } from '../logic/mock'
import { errorMessage, generateJson, GeminiError } from '../logic/gemini'
import { buildDiscussionContext, buildDiscussionSystem, replySchema } from '../logic/prompts'
import { flowDecision, nextSpeaker, paceDelay, trimRepetition } from '../logic/turn'
import { userReplyTarget } from '../logic/userReplyTarget'
import { jointDeliverableTemplate, nextStageOf, stageOrder } from '../logic/stages'

let counter = 0
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter += 1)}`

export type DebateEngine = {
  messages: Message[]
  thinking: boolean
  speakingId: AIId | null
  error: string | null
  ended: boolean
  paused: boolean
  startedAt: number | null
  stage: Stage
  stageStartedAt: number
  prepNotes: PrepNotes
  jointDeliverable: string
  demo: boolean
  begin: () => void
  sendUser: (text: string, source?: 'text' | 'speech') => void
  interrupt: () => void
  listenMore: () => void
  pause: () => void
  resume: () => void
  goToStage: (stage: Stage) => void
  nextStage: () => void
  setPrepNotes: (patch: Partial<PrepNotes>) => void
  setJointDeliverable: (text: string) => void
  end: () => Message[]
  clearError: () => void
  reset: () => void
}

export function useDebate(options: {
  topic: DebateTopic | null
  settings: Settings
  apiKey: string
  model: string | null
  onAutoEnd?: () => void
}): DebateEngine {
  const { topic, settings, apiKey, model, onAutoEnd } = options
  const [messages, setMessages] = useState<Message[]>([])
  const [thinking, setThinking] = useState(false)
  const [speakingId, setSpeakingId] = useState<AIId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)
  const [paused, setPaused] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [stage, setStage] = useState<Stage>('stage1')
  const [stageStartedAt, setStageStartedAt] = useState<number>(() => Date.now())
  const [prepNotes, setPrepNotesState] = useState<PrepNotes>(emptyPrepNotes)
  const [jointDeliverable, setJointDeliverableState] = useState('')

  const messagesRef = useRef<Message[]>([])
  const timerRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const endedRef = useRef(false)
  const pausedRef = useRef(false)
  const extraRef = useRef(0)
  const mountedRef = useRef(true)
  const turnRef = useRef(0)
  const topicRef = useRef(topic)
  const settingsRef = useRef(settings)
  const keyRef = useRef(apiKey)
  const modelRef = useRef(model)
  const autoEndRef = useRef(onAutoEnd)
  const stageRef = useRef<Stage>('stage1')
  const openedRef = useRef<Set<Stage>>(new Set())
  const prepRef = useRef<PrepNotes>(emptyPrepNotes)
  const errorRef = useRef<string | null>(null)
  const deliverableRef = useRef('')

  useEffect(() => {
    topicRef.current = topic
  }, [topic])
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  useEffect(() => {
    keyRef.current = apiKey
  }, [apiKey])
  useEffect(() => {
    modelRef.current = model
  }, [model])
  useEffect(() => {
    autoEndRef.current = onAutoEnd
  }, [onAutoEnd])
  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) window.clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const push = useCallback((message: Message) => {
    messagesRef.current = [...messagesRef.current, message]
    if (mountedRef.current) setMessages(messagesRef.current)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const abortInFlight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setThinking(false)
    setSpeakingId(null)
  }, [])

  const canAutoSpeak = useCallback(() => {
    const current = stageRef.current
    return current === 'stage2' || current === 'stage3'
  }, [])

  const schedule = useCallback(
    (delay?: number) => {
      clearTimer()
      if (endedRef.current || pausedRef.current || !canAutoSpeak()) return
      const current = topicRef.current
      if (!current) return
      const decision = flowDecision(messagesRef.current, settingsRef.current.debateMode, false, extraRef.current)
      if (!decision.continue) {
        if (decision.reason === 'budget') {
          endedRef.current = true
          setEnded(true)
          autoEndRef.current?.()
        }
        return
      }
      const speaker = nextSpeaker(messagesRef.current)
      const wait = delay ?? paceDelay[settingsRef.current.pace]
      timerRef.current = window.setTimeout(() => {
        void runAiTurn(speaker)
      }, wait)
    },
    // runAiTurn은 아래에서 정의되며 ref로 안정적으로 참조됩니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canAutoSpeak, clearTimer],
  )

  const runAiTurn = useCallback(
    async (speakerId: AIId) => {
      const current = topicRef.current
      if (!current || endedRef.current) return
      if (!canAutoSpeak()) return
      const controller = new AbortController()
      abortRef.current = controller
      setThinking(true)
      setSpeakingId(speakerId)
      const useDemo = !keyRef.current.trim()
      const activeStage = stageRef.current
      try {
        let text = ''
        if (useDemo) {
          await new Promise(resolve => window.setTimeout(resolve, 420))
          text = demoReply({
            topic: current,
            speakerId,
            messages: messagesRef.current,
            stage: activeStage,
            mode: settingsRef.current.debateMode,
          })
        } else {
          if (!modelRef.current) {
            throw new GeminiError(
              'NOT_FOUND',
              '사용할 Gemini 모델이 정해지지 않았어요. 설정에서 "연결 테스트 & 모델 불러오기"를 한 번 실행해 주세요.',
            )
          }
          const raw = await generateJson<{ text?: string }>({
            key: keyRef.current,
            model: modelRef.current,
            system: buildDiscussionSystem({
              topic: current,
              speakerId,
              stage: activeStage,
              style: settingsRef.current.discussionStyle,
              mode: settingsRef.current.debateMode,
            }),
            contents: buildDiscussionContext({
              topic: current,
              messages: messagesRef.current,
              speakerId,
              stage: activeStage,
              style: settingsRef.current.discussionStyle,
              prepNotes: prepRef.current,
            }),
            schema: replySchema,
            temperature: 1,
            maxOutputTokens: 1024,
            signal: controller.signal,
          })
          text = typeof raw?.text === 'string' ? raw.text.trim() : ''
          if (!text) throw new GeminiError('BAD_RESPONSE', '응답이 비어 있었어요. 다시 시도해 주세요.')
        }
        if (controller.signal.aborted || endedRef.current) return
        const clean = trimRepetition(text, messagesRef.current) ?? text
        turnRef.current += 1
        push({
          id: newId('m'),
          speakerId,
          text: clean,
          turnId: turnRef.current,
          timestamp: Date.now(),
          isUser: false,
          source: useDemo ? 'mock' : 'real',
          stage: activeStage,
        })
      } catch (error) {
        if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return
        if (!mountedRef.current) return
        const message = errorMessage(error)
        errorRef.current = message
        setError(message)
        pausedRef.current = true
        setPaused(true)
        return
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        if (mountedRef.current) {
          setThinking(false)
          setSpeakingId(null)
        }
      }
      schedule()
    },
    [canAutoSpeak, push, schedule],
  )

  const begin = useCallback(() => {
    endedRef.current = false
    pausedRef.current = false
    extraRef.current = 0
    turnRef.current = 0
    messagesRef.current = []
    openedRef.current = new Set()
    prepRef.current = emptyPrepNotes
    deliverableRef.current = ''
    setMessages([])
    setEnded(false)
    setPaused(false)
    setError(null)
    errorRef.current = null
    setStartedAt(Date.now())
    setStage('stage1')
    stageRef.current = 'stage1'
    setStageStartedAt(Date.now())
    setPrepNotesState(emptyPrepNotes)
    setJointDeliverableState('')
  }, [])

  const openStage = useCallback(
    (next: Stage, focus?: 'opening' | 'perspective') => {
      abortInFlight()
      clearTimer()
      pausedRef.current = false
      setPaused(false)
      setError(null)
      stageRef.current = next
      setStage(next)
      setStageStartedAt(Date.now())
      if (next === 'stage4' && !deliverableRef.current.trim()) {
        deliverableRef.current = jointDeliverableTemplate
        setJointDeliverableState(jointDeliverableTemplate)
      }
      if (next !== 'stage2' && next !== 'stage3') return
      if (openedRef.current.has(next)) {
        schedule(320)
        return
      }
      openedRef.current.add(next)
      const firstSpeaker: AIId = focus === 'perspective' ? 'ai2' : nextSpeaker(messagesRef.current)
      const wait = focus === 'perspective' ? 520 : 420
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        void runAiTurn(firstSpeaker)
      }, wait)
    },
    [abortInFlight, clearTimer, runAiTurn, schedule],
  )

  const goToStage = useCallback(
    (next: Stage) => {
      if (!stageOrder.includes(next) || endedRef.current) return
      openStage(next, next === 'stage3' ? 'perspective' : 'opening')
    },
    [openStage],
  )

  const nextStage = useCallback(() => {
    const next = nextStageOf(stageRef.current)
    if (next) goToStage(next)
  }, [goToStage])

  const sendUser = useCallback(
    (text: string, source: 'text' | 'speech' = 'text') => {
      const trimmed = text.trim()
      if (!trimmed || endedRef.current) return
      if (stageRef.current !== 'stage2' && stageRef.current !== 'stage3') return
      abortInFlight()
      clearTimer()
      extraRef.current = 0
      turnRef.current += 1
      push({
        id: newId('m'),
        speakerId: 'user',
        text: trimmed,
        turnId: turnRef.current,
        timestamp: Date.now(),
        isUser: true,
        source,
        stage: stageRef.current,
      })
      const reply = userReplyTarget(messagesRef.current)
      const speaker = reply ? reply.speakerId : nextSpeaker(messagesRef.current)
      const wait = settingsRef.current.pace === 'fast' ? 320 : 620
      timerRef.current = window.setTimeout(() => {
        void runAiTurn(speaker)
      }, wait)
    },
    [abortInFlight, clearTimer, push, runAiTurn],
  )

  const interrupt = useCallback(() => {
    clearTimer()
    abortInFlight()
  }, [abortInFlight, clearTimer])

  const listenMore = useCallback(() => {
    if (endedRef.current) return
    extraRef.current += 1
    pausedRef.current = false
    setPaused(false)
    schedule(380)
  }, [schedule])

  const pause = useCallback(() => {
    pausedRef.current = true
    setPaused(true)
    clearTimer()
  }, [clearTimer])

  const resume = useCallback(() => {
    if (endedRef.current) return
    // 실패로 멈춘 경우에는 이미 말한 턴 수를 한 번 더 허용해, 같은 지점에서 다시 시도합니다.
    if (errorRef.current) {
      errorRef.current = null
      extraRef.current += 1
      setError(null)
    }
    pausedRef.current = false
    setPaused(false)
    schedule(320)
  }, [schedule])

  const end = useCallback(() => {
    abortInFlight()
    clearTimer()
    endedRef.current = true
    setEnded(true)
    return messagesRef.current
  }, [abortInFlight, clearTimer])

  const clearError = useCallback(() => {
    errorRef.current = null
    setError(null)
  }, [])

  const setPrepNotes = useCallback((patch: Partial<PrepNotes>) => {
    setPrepNotesState(previous => {
      const next = { ...previous, ...patch }
      prepRef.current = next
      return next
    })
  }, [])

  const setJointDeliverable = useCallback((text: string) => {
    deliverableRef.current = text
    setJointDeliverableState(text)
  }, [])

  const reset = useCallback(() => {
    abortInFlight()
    clearTimer()
    endedRef.current = true
    messagesRef.current = []
    openedRef.current = new Set()
    prepRef.current = emptyPrepNotes
    deliverableRef.current = ''
    setMessages([])
    setEnded(false)
    setPaused(false)
    setError(null)
    errorRef.current = null
    setStartedAt(null)
    setStage('stage1')
    stageRef.current = 'stage1'
    setPrepNotesState(emptyPrepNotes)
    setJointDeliverableState('')
    turnRef.current = 0
    extraRef.current = 0
  }, [abortInFlight, clearTimer])

  return {
    messages,
    thinking,
    speakingId,
    error,
    ended,
    paused,
    startedAt,
    stage,
    stageStartedAt,
    prepNotes,
    jointDeliverable,
    demo: !apiKey.trim(),
    begin,
    sendUser,
    interrupt,
    listenMore,
    pause,
    resume,
    goToStage,
    nextStage,
    setPrepNotes,
    setJointDeliverable,
    end,
    clearError,
    reset,
  }
}

export const speakerName = nameOf
export const speakerIds = aiIds
