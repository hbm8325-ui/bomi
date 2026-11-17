/** 앱 전역 타입 정의 */

export type ResourceTable = {
  /** 표 제목 (예: '표 1. 신규 PR 구성물질 물성·독성') */
  caption?: string
  head: string[]
  rows: string[][]
  /** 단위·각주 (예: '주1) 25℃, 1 atm 기준. ppm은 부피비') */
  note?: string
}

export type ResourceBlock =
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'table'; table: ResourceTable }

export type Resource = {
  id: string
  /** '자료 1' 처럼 화면에 보이는 짧은 이름 */
  label: string
  /** 파일명처럼 보이는 제목 */
  title: string
  /** 한 줄 요지 (탭 아래 요약) */
  summary: string
  blocks: ResourceBlock[]
  /** 문서 끝 각주 */
  footnote?: string
  /** 탭 상단 강조 (예: '실측 2026-10-14') */
  meta?: string
}

export type Trap = {
  id: string
  title: string
  /** 무엇이 함정인지 (채점 리포트에 그대로 나감) */
  detail: string
  /** 답안/대화에서 이 함정을 '짚었다'고 볼 표현 */
  keywords: string[]
}

export type Difficulty = '입문' | '보통' | '심화'

/** 모범답안 + 복습용 포인트. 시험을 시작하지 않아도 읽고 복사할 수 있습니다. */
export type ModelAnswer = {
  /** 실제 제출용 두괄식 보고서(900~1,400자) */
  report: string
  /** 왜 이렇게 결론을 잡았는가 — 핵심 설계 포인트 3개 */
  points: string[]
  /** 이 문제에서 외부 AI에게 이렇게 질문하면 좋은 예시 */
  samplePrompts: string[]
}

export type Scenario = {
  id: string
  /** '과제 1' */
  code: string
  title: string
  /** 분야 태그: 보건 / 공통 / 사용자 추가 */
  field: string
  /** 난이도(선택). 정렬은 입문 → 보통 → 심화 */
  difficulty?: Difficulty
  background: string
  mission: string
  constraints: string[]
  resources: Resource[]
  traps: Trap[]
  /** 이 과제에서 AI에게 특히 물어봐야 할 것 (코치 힌트, 선택) */
  mustAsk?: string[]
  /** 모범답안(선택) — 내장 16세트에는 모두 있음 */
  modelAnswer?: ModelAnswer
  source: 'builtin' | 'custom'
  createdAt?: number
}

export type ChatRole = 'user' | 'ai'

export type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  at: number
  /** 데모 모드 응답 여부 */
  demo?: boolean
  /** 연습 코치 팁 (넓은 프롬프트 감지 시) */
  coachTip?: string
  /** 실패 안내 */
  error?: boolean
}

export type ScoreItemKey = 'problem' | 'prompt' | 'domain' | 'structure'

export type ScoreItem = {
  key: ScoreItemKey
  label: string
  max: number
  score: number
  comment: string
  /** 답안/대화에서 인용한 근거 */
  evidence?: string
}

export type TrapFinding = {
  title: string
  found: boolean
  evidence: string
}

export type FollowUp = {
  question: string
  /** 왜 이 질문이 나오는지 */
  intent: string
  /** 모범 방어 포인트 */
  points: string[]
  /** 지원자 답안/로그에서 인용한 문장 */
  quote?: string
  /** 지원자가 써 본 방어 답변 */
  rehearsal?: string
  /** 그 답변에 대한 3줄 코칭 */
  rehearsalFeedback?: string[]
}

export type PresentationScript = {
  hook: string
  frame: string
  solution: string
  close: string
}

export type GradeResult = {
  total: number
  items: ScoreItem[]
  overall: string
  strengths: string[]
  improvements: string[]
  traps: TrapFinding[]
  followUps: FollowUp[]
  presentation: PresentationScript
  /** 데모(로컬 휴리스틱) 채점 여부 */
  demo?: boolean
  /** 채점 시각 */
  at?: number
  model?: string
}

export type Attempt = {
  id: string
  at: number
  scenarioId: string
  scenarioCode: string
  scenarioTitle: string
  field: string
  score: number
  answerLength: number
  chatTurns: number
  durationSec: number
  autoSubmitted?: boolean
  grade: GradeResult
  answer: string
  chat: ChatMessage[]
}

export type TimerState = {
  /** 제한시간(분) — 35 또는 30 */
  limit: number
  /** 남은 초 */
  remaining: number
  running: boolean
  /** running 일 때 종료 예정 시각(ms) */
  endAt: number | null
  /** 이번 세션에서 시작했는지 */
  startedAt: number | null
}

export type Settings = {
  apiKey: string
  model: string | null
  coachOn: boolean
}
