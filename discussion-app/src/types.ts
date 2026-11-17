export type AIId = 'ai1' | 'ai2' | 'ai3'
export type SpeakerId = 'user' | AIId

/** SK하이닉스 Half-Day 4단계 그룹 토의 진행 단계 */
export type Stage = 'stage1' | 'stage2' | 'stage3' | 'stage4'

/** 토의 성향: 합의·조율(기본) / 찬반 집중 */
export type DiscussionStyle = 'consensus' | 'debate'

export type TopicContext = { situation?: string; keyIssue?: string; goal?: string }

/** 모범 토의 & 결과물 가이드 */
export type ModelGuide = {
  /** 핵심 관점 3가지 (민준·서연·도현 순) */
  perspectives: readonly [string, string, string]
  /** 30초 첫 발언 예시 */
  openingExample: string
  /** 3단계 추가 관점 조율 멘트 */
  synthesisExample: string
  /** 완성된 공동 결과물 예시 */
  jointDeliverableExample: string
}

export type DebateTopic = {
  id: string
  title: string
  category: string
  source: 'prepared' | 'custom'
  context?: TopicContext
  /** 3단계에서 새로 투입되는 추가 관점 */
  additionalPerspective?: string
  /** 모범 토의 & 결과물 가이드 */
  modelGuide?: ModelGuide
  mockPoints?: readonly [string, string, string]
}

export type AIPersona = {
  id: AIId
  personality: string
  speechStyle: string
  lens: string
  rules: readonly string[]
  exampleExpressions: readonly string[]
}

export type Participant = {
  id: SpeakerId
  name: string
  initials: string
  role: string
  description: string
}

export type Message = {
  id: string
  speakerId: SpeakerId
  text: string
  turnId: number
  timestamp: number
  isUser: boolean
  source: 'mock' | 'real' | 'text' | 'speech'
  /** 이 발언이 나온 단계 */
  stage?: Stage
}

/** 1단계 개인 의견 준비 메모 */
export type PrepNotes = {
  position: string
  evidence: string
  expectedViews: string
}

export const emptyPrepNotes: PrepNotes = { position: '', evidence: '', expectedViews: '' }

/** 토론 표시 모드: normal = 전체 공개, real = 이전 AI 발언 가림(실전) */
export type DisplayMode = 'normal' | 'real'
/** 토론 깊이 */
export type DebateMode = 'basic' | 'deep'
/** AI 응답 간격 */
export type Pace = 'relaxed' | 'normal' | 'fast'

export type Settings = {
  displayMode: DisplayMode
  debateMode: DebateMode
  pace: Pace
  model: string | null
  voice: boolean
  /** 토의 성향: consensus(합의·조율, 기본) | debate(찬반 집중) */
  discussionStyle: DiscussionStyle
  /** AI 발언 음성 재생(TTS) */
  tts: boolean
}

export type CriterionKey = 'logic' | 'rebuttal' | 'interaction' | 'contribution' | 'expression'

export type CriterionScore = {
  key: CriterionKey
  label: string
  observed: boolean
  score: number | null
  reason: string
  citations: string[]
  improvement: string
}

/** 면접관 꼬리질문 + 1:1 방어 답변 리허설 */
export type FollowUp = {
  question: string
  intent: string
  points: string[]
  quote?: string
  defense?: string
  coaching?: string[]
}

export type Feedback = {
  summary: string
  total: number | null
  criteria: CriterionScore[]
  strengths: string[]
  improvements: string[]
  rewrites: { original: string; improved: string; why: string }[]
  nextSteps: string[]
  followUps?: FollowUp[]
  createdAt: number
  demo?: boolean
}

export type SavedSession = {
  id: string
  topicId: string
  topicTitle: string
  topicContext?: TopicContext
  category: string
  mode: DebateMode
  model: string | null
  startedAt: number
  endedAt: number
  messages: Message[]
  feedback: Feedback | null
  /** 4단계 그룹 토의 확장 필드(기존 기록 호환을 위해 모두 선택) */
  prepNotes?: PrepNotes
  additionalPerspective?: string
  jointDeliverable?: string
  discussionStyle?: DiscussionStyle
}
