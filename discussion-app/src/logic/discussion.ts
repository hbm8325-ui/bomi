import type { DebateTopic, FollowUp, Message, PrepNotes } from '../types'
import { nameOf } from '../data/participants'
import { jointDeliverableTemplate } from './stages'

const clip = (text: string, max = 90): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

const firstQuestion = (topic: DebateTopic): string => {
  const text = (topic.additionalPerspective ?? '').trim()
  const cut = text.split(/(?<=[?？])\s/)[0]
  return cut || text
}

const userMessages = (messages: readonly Message[]) => messages.filter(m => m.speakerId === 'user')

/** 데모 모드 공동 결과물 초안 — 내 메모와 실제 토의 발언만 재료로 씁니다. */
export function demoDraft(options: {
  topic: DebateTopic
  messages: readonly Message[]
  prepNotes?: PrepNotes | null
}): string {
  const { topic, messages, prepNotes } = options
  const mine = userMessages(messages)
  const guide = topic.modelGuide
  const position = prepNotes?.position.trim() || mine[0]?.text.trim() || guide?.perspectives[0] || '합의 방향을 정리 중입니다.'
  const evidence = prepNotes?.evidence.trim() || mine[1]?.text.trim() || guide?.perspectives[1] || '토의에서 나온 근거를 정리합니다.'
  const expected = prepNotes?.expectedViews.trim() || guide?.perspectives[2] || '다른 관점의 우려를 반영합니다.'
  return jointDeliverableTemplate
    .replace(
      '[1. 우리 조의 합의 방향(결론)]\n',
      `[1. 우리 조의 합의 방향(결론)]\n${clip(position, 140)}\n`,
    )
    .replace(
      '[2. 핵심 근거와 우선 기준]\n',
      `[2. 핵심 근거와 우선 기준]\n· ${clip(evidence, 120)}\n· 다른 관점으로 나온 우려(${clip(expected, 70)})를 우선 기준에 함께 둡니다.\n`,
    )
    .replace(
      '[3. 추가 관점 반영 및 예외·보완 조건]\n',
      `[3. 추가 관점 반영 및 예외·보완 조건]\n· ${clip(firstQuestion(topic), 120)}\n· 이 관점 때문에 결론을 유지하되, 예외 조건과 확인 절차를 한 줄 덧붙입니다.\n`,
    )
    .replace(
      '[4. 실행 방안 및 남은 과제]\n',
      `[4. 실행 방안 및 남은 과제]\n· ① 작은 범위에서 먼저 적용하고 결과를 공개합니다. ② 담당자와 점검 주기를 정합니다. ③ 3개월 뒤 기준을 다시 검토합니다.\n· 남은 과제: 예외를 인정할 범위와 비용 부담 주체를 확정하는 일입니다.\n`,
    )
}

/** 데모 보완 피드백 — 3줄 코칭 */
export function demoReview(options: { topic: DebateTopic; draft: string }): string[] {
  const { topic, draft } = options
  const text = draft.replace(/\s+/g, ' ').trim()
  const hasPerspective = /추가|관점|3단계/.test(text)
  const hasException = /예외|조건|보완/.test(text)
  const hasAction = /실행|담당|주기|기한|개월/.test(text)
  const lines = [
    hasPerspective
      ? `빠진 관점: 3단계 관점은 언급됐지만, "${clip(firstQuestion(topic), 60)}"에 대한 답이 결론 문장에 직접 연결되지 않았습니다.`
      : `빠진 관점: 3단계 추가 관점("${clip(firstQuestion(topic), 60)}")이 결과물에 보이지 않습니다. 3번 항목에 먼저 넣어야 합니다.`,
    hasException
      ? '약한 합의: 예외 조건은 있으나, 누가 판단하는지가 빠져 현장에서 기준이 갈릴 수 있습니다.'
      : '약한 합의: 합의 방향만 있고 예외·보완 조건이 비어 있어 반대 관점을 설득하기 어렵습니다.',
    hasAction
      ? '다음 문장: "실행 첫 주에 예외 신청 창구를 열고, 접수 건수와 처리 결과를 팀에 공개한다."를 4번 항목 끝에 붙이면 좋겠습니다.'
      : '다음 문장: "실행 방안은 3개월 시범 → 결과 공개 → 기준 조정 순으로 두고, 담당은 팀장으로 둔다."를 4번 항목에 추가하세요.',
  ]
  return lines
}

/** 데모 1:1 방어 답변 코칭 — 3줄 */
export function demoRehearsal(options: { followUp: FollowUp; defense: string }): string[] {
  const { followUp, defense } = options
  const flat = defense.replace(/\s+/g, ' ').trim()
  const firstSentence = flat.split(/(?<=[.!?])\s/)[0] ?? flat
  const conclusionFirst =
    firstSentence.length > 0 && firstSentence.length <= 70
      ? '결론 먼저: 첫 문장에서 답이 분명히 들립니다. 이 구조를 유지하세요.'
      : '결론 먼저: 첫 문장이 길어 핵심이 늦게 들립니다. "결론부터 말씀드리면 ~입니다."로 15자 안에 답을 먼저 두세요.'
  const evidence = followUp.points[0] ?? '토의에서 정한 우선 기준'
  const missed = followUp.points[1] ?? followUp.quote ?? '반대 관점의 우려'
  return [
    conclusionFirst,
    `근거 보강: "${clip(evidence, 70)}"를 근거로 붙이면 답이 단단해집니다. 공동 결과물의 문장을 그대로 인용해도 좋습니다.`,
    `놓친 지점: "${clip(missed, 70)}"에 대한 답이 빠졌습니다. 이 부분을 한 문장으로 먼저 인정하고 조건을 붙이세요.`,
  ]
}

/** 데모 꼬리질문 3개 — 내 발언과 결과물을 실제로 짚습니다. */
export function demoFollowUps(options: {
  topic: DebateTopic
  messages: readonly Message[]
  jointDeliverable?: string | null
}): FollowUp[] {
  const { topic, messages, jointDeliverable } = options
  const mine = userMessages(messages)
  const first = mine[0]?.text.trim()
  const last = mine.at(-1)?.text.trim()
  const deliverable = (jointDeliverable ?? '').trim()
  const questions: FollowUp[] = []

  if (first) {
    questions.push({
      question: `${nameOf('ai3')} 팀원이 실행 부담을 지적했을 때, 처음 말씀하신 기준을 어떻게 조정하시겠습니까?`,
      intent: '자기 기준을 유지하면서 다른 관점을 수용하는 조율 능력을 확인합니다.',
      points: ['처음 기준에서 유지할 부분과 바꿀 부분을 구분', '실행 주체·비용을 함께 언급', '조정한 이유를 한 문장으로'],
      quote: clip(first, 70),
    })
  }
  questions.push({
    question: `3단계에서 나온 추가 관점("${clip(firstQuestion(topic), 60)}")을 결과물의 어느 문장에 반영하셨나요?`,
    intent: '토의 중 새로 주어진 조건을 실제 결론에 반영했는지 확인합니다.',
    points: ['추가 관점을 한 문장으로 요약', '결론이 유지되는지 수정되는지 명시', '예외·보완 조건 제시'],
  })
  if (deliverable) {
    questions.push({
      question: '공동 결과물의 실행 항목 중 본인이 직접 맡을 부분은 무엇이고, 언제까지 하시겠습니까?',
      intent: '합의안을 실제 행동으로 옮기는 실행력을 확인합니다.',
      points: ['본인 역할을 구체적으로', '기한과 확인 방법', '남은 과제 중 우선순위'],
      quote: clip(deliverable.split('\n').filter(Boolean).at(-1) ?? deliverable, 70),
    })
  } else if (last) {
    questions.push({
      question: '오늘 토의에서 합의하지 못한 부분은 무엇이고, 다음 자리에서 무엇부터 확인하시겠습니까?',
      intent: '남은 쟁점을 인식하고 우선순위를 정하는 능력을 확인합니다.',
      points: ['남은 쟁점 하나를 명확히', '다음 확인 순서', '확인에 필요한 자료'],
      quote: clip(last, 70),
    })
  }
  const extras: FollowUp[] = [
    {
      question: '만약 이해관계자 한 명이 합의안에 반대한다면, 어떤 조건을 더 받아들일 수 있습니까?',
      intent: '합의의 한계와 양보 가능 범위를 확인합니다.',
      points: ['양보 가능한 조건', '양보할 수 없는 원칙', '재협의 절차'],
    },
    {
      question: '오늘 토의에서 합의하지 못한 부분은 무엇이고, 다음 자리에서 무엇부터 확인하시겠습니까?',
      intent: '남은 쟁점을 인식하고 우선순위를 정하는 능력을 확인합니다.',
      points: ['남은 쟁점 하나', '다음 확인 순서', '확인에 필요한 자료'],
    },
    {
      question: '우리 조의 결론을 반대하는 사람에게 30초로 설명한다면, 어떤 근거부터 말하시겠습니까?',
      intent: '결론을 근거와 함께 압축해 전달하는 능력을 확인합니다.',
      points: ['핵심 기준 한 가지', '가장 강한 근거', '예외 조건'],
    },
  ]
  for (const extra of extras) {
    if (questions.length >= 3) break
    if (!questions.some(item => item.question === extra.question)) questions.push(extra)
  }
  return questions.slice(0, 3)
}

/** 모델이 준 줄 목록을 3줄로 정리합니다. */
export function normalizeLines(value: unknown, fallback: string[] = []): string[] {
  const lines = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim())
    : []
  const merged = [...lines, ...fallback].slice(0, 3)
  while (merged.length < 3) merged.push('')
  return merged
}
