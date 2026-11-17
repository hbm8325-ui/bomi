import type { Stage } from '../types'

export type StageInfo = {
  id: Stage
  number: number
  label: string
  short: string
  minutes: number
  goal: string
}

/** SK하이닉스 Half-Day Step 4 Group Discussion의 공식 4단계(총 40분)를 연습용으로 옮긴 진행표입니다. */
export const stageList: readonly StageInfo[] = [
  {
    id: 'stage1',
    number: 1,
    label: '개인 의견 준비',
    short: '준비',
    minutes: 5,
    goal: '주제 배경과 쟁점을 읽고 내 입장·근거·예상 관점을 메모합니다.',
  },
  {
    id: 'stage2',
    number: 2,
    label: '1차 토의',
    short: '1차 토의',
    minutes: 10,
    goal: '세 팀원과 각자의 관점을 나누고 공통 기준을 찾습니다.',
  },
  {
    id: 'stage3',
    number: 3,
    label: '추가 관점 확인 · 2차 토의',
    short: '2차 토의',
    minutes: 15,
    goal: '새로 공개된 추가 관점을 반영해 1차 토의의 기준과 결론을 조정합니다.',
  },
  {
    id: 'stage4',
    number: 4,
    label: '공동 결과물 작성',
    short: '결과물',
    minutes: 10,
    goal: '팀원과 함께 합의안을 작성하고 다듬어 제출합니다.',
  },
]

export const stageOrder: readonly Stage[] = stageList.map(item => item.id)

export function stageInfo(stage: Stage): StageInfo {
  return stageList.find(item => item.id === stage) ?? stageList[0]
}

export function stageNumberOf(stage: Stage): number {
  return stageInfo(stage).number
}

export function nextStageOf(stage: Stage): Stage | null {
  const index = stageOrder.indexOf(stage)
  return index >= 0 && index < stageOrder.length - 1 ? stageOrder[index + 1] : null
}

export function previousStageOf(stage: Stage): Stage | null {
  const index = stageOrder.indexOf(stage)
  return index > 0 ? stageOrder[index - 1] : null
}

/** 단계별 진행 안내 문구 */
export const stageGuide: Record<Stage, string> = {
  stage1: '5분 동안 내 생각을 정리해 보세요. 여기 적은 메모는 2·3·4단계에서 접어서 계속 볼 수 있습니다.',
  stage2: '10분 1차 토의입니다. 정답을 정하기보다 서로의 판단 기준과 겹치는 지점을 찾아보세요.',
  stage3: '추가 관점이 공개됐습니다. 이 관점이 1차 토의의 결론을 어떻게 바꾸는지 반드시 다뤄 보세요.',
  stage4: '10분 동안 합의안을 완성합니다. AI 팀원에게 초안과 피드백을 요청할 수 있습니다.',
}

/** 공동 결과물 기본 템플릿 */
export const jointDeliverableTemplate = [
  '[1. 우리 조의 합의 방향(결론)]',
  '',
  '',
  '[2. 핵심 근거와 우선 기준]',
  '',
  '',
  '[3. 추가 관점 반영 및 예외·보완 조건]',
  '',
  '',
  '[4. 실행 방안 및 남은 과제]',
  '',
].join('\n')

/** 템플릿 머리말만 있는 상태를 '결과물 없음'으로 보기 위한 판별 */
export const deliverableHasContent = (text: string): boolean =>
  text.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, '').length >= 10

export const jointDeliverableSections = [
  { key: 'direction', label: '1. 합의 방향(결론)', hint: '한두 문장으로 우리 조의 결론' },
  { key: 'criteria', label: '2. 핵심 근거와 우선 기준', hint: '왜 그렇게 정했는지, 무엇을 먼저 봤는지' },
  { key: 'perspective', label: '3. 추가 관점 반영·예외 조건', hint: '3단계 관점을 어떻게 반영했는지' },
  { key: 'action', label: '4. 실행 방안·남은 과제', hint: '누가 언제 무엇을, 남은 숙제' },
] as const
