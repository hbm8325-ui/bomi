import { criterionLabels, criterionOrder } from '../data/rubric'
import type { CriterionKey, CriterionScore, DebateTopic, Feedback, FollowUp, Message, PrepNotes } from '../types'
import { userUtteranceIds } from './prompts'
import { demoFollowUps } from './discussion'

export type RawCriterion = {
  key?: string
  observed?: boolean
  score?: number | string
  reason?: string
  citations?: unknown
  improvement?: string
}

export type RawFollowUp = {
  question?: string
  intent?: string
  points?: unknown
  quote?: string
}

export type RawFeedback = {
  summary?: string
  strengths?: unknown
  improvements?: unknown
  criteria?: RawCriterion[]
  rewrites?: { original?: string; improved?: string; why?: string }[]
  followUps?: RawFollowUp[]
  nextSteps?: unknown
}

const stringList = (value: unknown, limit = 6): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim())
        .slice(0, limit)
    : []

const clampScore = (value: unknown): number | null => {
  const num = typeof value === 'string' ? Number(value) : value
  if (typeof num !== 'number' || !Number.isFinite(num)) return null
  return Math.max(0, Math.min(100, Math.round(num)))
}

/** 꼬리질문 3개를 정규화합니다. 모델이 적게 주면 데모 질문으로 채웁니다. */
export function normalizeFollowUps(
  raw: unknown,
  fallback: FollowUp[] = [],
  limit = 3,
): FollowUp[] {
  const list = Array.isArray(raw) ? raw : []
  const parsed: FollowUp[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const value = item as RawFollowUp
    const question = typeof value.question === 'string' ? value.question.trim() : ''
    if (!question) continue
    const points = Array.isArray(value.points)
      ? value.points.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map(p => p.trim())
      : []
    parsed.push({
      question,
      intent: (value.intent ?? '').trim() || '답변의 근거와 일관성을 확인하는 질문입니다.',
      points: points.slice(0, 4),
      ...(typeof value.quote === 'string' && value.quote.trim() ? { quote: value.quote.trim() } : {}),
    })
    if (parsed.length >= limit) break
  }
  const merged = [...parsed]
  for (const item of fallback) {
    if (merged.length >= limit) break
    if (!merged.some(existing => existing.question === item.question)) merged.push(item)
  }
  return merged.slice(0, limit)
}

/** 모델 출력이 스키마에서 조금 벗어나도 평가 카드로 쓸 수 있게 정규화합니다. */
export function normalizeFeedback(raw: RawFeedback, now = Date.now(), demo = false): Feedback {
  const byKey = new Map<string, RawCriterion>()
  for (const item of raw.criteria ?? []) {
    if (item && typeof item.key === 'string') byKey.set(item.key.trim().toLowerCase(), item)
  }
  const criteria: CriterionScore[] = criterionOrder.map((key: CriterionKey) => {
    const item = byKey.get(key)
    const score = clampScore(item?.score)
    const observed = item?.observed === false || score === null ? false : score !== 0 || item?.observed === true
    const citations = Array.isArray(item?.citations)
      ? item.citations
          .filter((c): c is string => typeof c === 'string')
          .map(c => c.trim())
          .filter(c => /^#U\d+$/.test(c))
          .slice(0, 6)
      : []
    return {
      key,
      label: criterionLabels[key],
      observed,
      score: observed ? score : null,
      reason: (item?.reason ?? '').trim() || '이 항목에 대한 평가가 응답에 없었습니다.',
      citations,
      improvement: (item?.improvement ?? '').trim(),
    }
  })
  const observedScores = criteria.filter(c => c.observed && c.score !== null).map(c => c.score as number)
  const total = observedScores.length
    ? Math.round(observedScores.reduce((sum, value) => sum + value, 0) / observedScores.length)
    : null
  const rewrites = (Array.isArray(raw.rewrites) ? raw.rewrites : [])
    .filter(r => r && typeof r.improved === 'string' && r.improved.trim())
    .map(r => ({
      original: (r.original ?? '').trim(),
      improved: (r.improved ?? '').trim(),
      why: (r.why ?? '').trim(),
    }))
    .slice(0, 4)
  return {
    summary: (raw.summary ?? '').trim() || '이번 토의의 평가 요약이 비어 있습니다.',
    total,
    criteria,
    strengths: stringList(raw.strengths),
    improvements: stringList(raw.improvements),
    rewrites,
    nextSteps: stringList(raw.nextSteps),
    followUps: normalizeFollowUps(raw.followUps),
    createdAt: now,
    demo,
  }
}

/** API 없이 미리보기 할 때 쓰는 데모 피드백. 실제 평가가 아님을 demo로 표시합니다. */
export function demoFeedback(
  input: {
    messages: readonly Message[]
    topic?: DebateTopic | null
    prepNotes?: PrepNotes | null
    jointDeliverable?: string | null
  },
  now = Date.now(),
): Feedback {
  const { messages, topic, jointDeliverable } = input
  const ids = userUtteranceIds(messages)
  const userMessages = messages.filter(m => m.speakerId === 'user')
  const lengths = userMessages.map(m => m.text.replace(/\s+/g, '').length)
  const avg = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0
  const askedQuestions = userMessages.filter(m => /[?？]|까요|나요|죠\?/.test(m.text)).length
  const names = /민준|서연|도현/
  const addressed = userMessages.filter(m => names.test(m.text)).length
  const coordinated = userMessages.filter(m => /조정|합의|조건|예외|기준|반영|우선/.test(m.text)).length
  const first = userMessages[0] ? ids.get(userMessages[0].id) ?? '#U1' : '#U1'
  const balance = (base: number, bonus: number, cap = 88) => Math.max(35, Math.min(cap, Math.round(base + bonus)))
  const depth = Math.min(18, Math.round(avg / 12))
  const hasDeliverable = !!(jointDeliverable ?? '').trim()
  const hasPerspective = /추가|관점/.test(jointDeliverable ?? '')
  const criteria: CriterionScore[] = [
    {
      key: 'logic',
      label: criterionLabels.logic,
      observed: userMessages.length > 0,
      score: userMessages.length ? balance(52, depth + coordinated * 3) : null,
      reason: userMessages.length
        ? `${first}에서 판단 기준을 먼저 밝히고 이유를 붙였습니다. 다만 기준이 뒤집히는 조건까지는 보이지 않았습니다.`
        : '평가할 발언이 없습니다.',
      citations: userMessages.length ? [first] : [],
      improvement: '기준을 말한 뒤 "이 조건이면 결론이 달라진다"를 한 문장 덧붙여 보세요.',
    },
    {
      key: 'rebuttal',
      label: criterionLabels.rebuttal,
      observed: userMessages.length > 1,
      score: userMessages.length > 1 ? balance(50, depth / 2 + coordinated * 5) : null,
      reason:
        userMessages.length > 1
          ? '다른 참가자의 관점을 언급하며 조건을 조정하려 했습니다. 상대 근거의 핵심을 직접 인정하거나 반박하는 문장은 짧았습니다. 추가 관점 반영은 더 분명히 드러낼 수 있습니다.'
          : '관점을 조율할 기회가 기록에 없어 평가를 보류했습니다.',
      citations: userMessages.length > 1 ? [...ids.values()].slice(-2) : [],
      improvement: '상대 기준을 한 줄로 요약한 뒤, 내가 받아들일 부분과 조정할 부분을 나눠 말해 보세요.',
    },
    {
      key: 'interaction',
      label: criterionLabels.interaction,
      observed: userMessages.length > 0,
      score: userMessages.length ? balance(54, addressed * 6 + askedQuestions * 3) : null,
      reason: '대화 흐름을 따라가며 자기 차례를 만들었습니다. 팀원의 질문에 직접 답하는 문장을 조금 더 넣을 수 있습니다.',
      citations: userMessages.length ? [first] : [],
      improvement: '발언 첫 문장에서 방금 나온 질문이나 우려를 한 줄로 요약하고 답부터 말해 보세요.',
    },
    {
      key: 'contribution',
      label: criterionLabels.contribution,
      observed: userMessages.length > 1 || hasDeliverable,
      score:
        userMessages.length > 1 || hasDeliverable
          ? balance(50, depth / 2 + coordinated * 3 + (hasDeliverable ? 8 : 0) + (hasPerspective ? 4 : 0))
          : null,
      reason: hasDeliverable
        ? `공동 결과물이 ${hasPerspective ? '추가 관점까지 반영해' : '작성됐지만 추가 관점 반영은 약하게'} 4개 항목으로 정리됐습니다. 실행 항목에 담당과 기한을 넣으면 더 구체적입니다.`
        : '새로운 기준을 하나 제시했습니다. 이미 나온 의견을 다시 말한 부분은 줄이면 더 선명해집니다.',
      citations: userMessages.length > 1 ? [...ids.values()].slice(-1) : [],
      improvement: '합의안 문장에 실행 주체와 점검 시점을 함께 적어 보세요.',
    },
    {
      key: 'expression',
      label: criterionLabels.expression,
      observed: userMessages.length > 0,
      score: userMessages.length ? balance(58, avg > 50 ? 6 : 2, 90) : null,
      reason: '핵심 기준과 이유를 알아듣기 쉽게 전달했습니다. 문장이 길어지는 구간은 한 번 끊어 주면 좋습니다.',
      citations: userMessages.length ? [first] : [],
      improvement: '한 문장에 조건을 두 개 이상 넣지 말고, 이유는 별도 문장으로 나눠 말해 보세요.',
    },
  ]
  const observed = criteria.filter(c => c.score !== null).map(c => c.score as number)
  const fallbackTopic: DebateTopic = topic ?? {
    id: 'demo',
    title: '오늘의 토의 주제',
    category: '연습',
    source: 'custom',
    additionalPerspective: '토의 중 새로운 조건이 제시되는 상황을 가정합니다.',
  }
  return {
    summary:
      '데모 모드에서 만든 예시 피드백입니다. 실제 Gemini 평가가 아니므로 참고용으로만 봐 주세요. 기준을 세우고 다른 관점을 조율하는 구조가 잡히면 점수가 함께 오르는 유형입니다.',
    total: observed.length ? Math.round(observed.reduce((a, b) => a + b, 0) / observed.length) : null,
    criteria,
    strengths: ['판단 기준을 먼저 밝히고 이유를 붙이는 구조가 분명합니다.', '다른 참가자의 관점을 조율하려는 시도가 보입니다.'],
    improvements: ['추가 관점을 결론 문장에 직접 연결해 보세요.', '합의안의 실행 항목에 담당과 기한을 넣어 보세요.'],
    rewrites: userMessages[0]
      ? [
          {
            original: userMessages[0].text,
            improved: `${userMessages[0].text} 다만 추가 관점까지 반영하면 예외 조건을 하나 더 정해야 해서, 그 기준을 함께 정리하면 좋겠습니다.`,
            why: '추가 관점과 예외 조건을 덧붙여 합의안으로 이어지는 문장으로 바꿨습니다.',
          },
        ]
      : [],
    nextSteps: ['3단계 추가 관점을 내 발언에 한 번 이상 직접 언급하며 결론 변화를 설명해 보세요.'],
    followUps: demoFollowUps({ topic: fallbackTopic, messages, jointDeliverable }),
    createdAt: now,
    demo: true,
  }
}
