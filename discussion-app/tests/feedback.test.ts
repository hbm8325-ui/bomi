import { describe, expect, it } from 'vitest'
import { demoFeedback, normalizeFeedback, normalizeFollowUps } from '../src/logic/feedback'
import { criterionLabels, criterionOrder } from '../src/data/rubric'
import { practiceTopics } from '../src/data/topics'
import type { Message } from '../src/types'

const userMessages: Message[] = [
  { id: 'm1', speakerId: 'user', text: '저는 조건부로 찬성합니다. 비용을 누가 부담하는지가 핵심입니다.', turnId: 1, timestamp: 0, isUser: true, source: 'text', stage: 'stage2' },
  { id: 'm2', speakerId: 'ai1', text: '그 기준이면 예외를 어디까지 인정할지가 중요합니다.', turnId: 2, timestamp: 0, isUser: false, source: 'real', stage: 'stage2' },
  { id: 'm3', speakerId: 'user', text: '민준 님 말처럼 예외는 비용 부담 주체가 정해질 때만 인정해야 합니다. 그래서 공개 기준이 필요합니다.', turnId: 3, timestamp: 0, isUser: true, source: 'speech', stage: 'stage3' },
]

describe('피드백 정규화', () => {
  it('다섯 기준을 항상 이 순서로 채우고 라벨은 그룹 토의 기준이다', () => {
    const feedback = normalizeFeedback({
      summary: '요약',
      criteria: [
        { key: 'expression', observed: true, score: 80, reason: '명확합니다.', citations: ['#U1'], improvement: '조건을 나누세요.' },
        { key: 'logic', observed: true, score: 70, reason: '근거가 있습니다.', citations: ['#U1', '#U2', 'U3'], improvement: '반례를 넣으세요.' },
      ],
    })
    expect(feedback.criteria.map(c => c.key)).toEqual([...criterionOrder])
    expect(feedback.criteria.map(c => c.label)).toEqual(criterionOrder.map(key => criterionLabels[key]))
    expect(criterionLabels.rebuttal).toBe('관점 수용·조율')
    expect(criterionLabels.contribution).toBe('토의·결과물 기여')
    const logic = feedback.criteria.find(c => c.key === 'logic')!
    expect(logic.score).toBe(70)
    expect(logic.citations).toEqual(['#U1', '#U2'])
    const rebuttal = feedback.criteria.find(c => c.key === 'rebuttal')!
    expect(rebuttal.observed).toBe(false)
    expect(rebuttal.score).toBeNull()
  })

  it('관찰한 항목만 평균 내어 100점 총점을 만든다', () => {
    const feedback = normalizeFeedback({
      criteria: [
        { key: 'logic', observed: true, score: 80 },
        { key: 'rebuttal', observed: true, score: 60 },
        { key: 'interaction', observed: false, score: 0 },
        { key: 'contribution', observed: true, score: 70 },
        { key: 'expression', observed: true, score: 90 },
      ],
    })
    expect(feedback.total).toBe(Math.round((80 + 60 + 70 + 90) / 4))
    expect(feedback.criteria.find(c => c.key === 'interaction')?.score).toBeNull()
  })

  it('점수를 0~100 정수로 자른다', () => {
    const feedback = normalizeFeedback({
      criteria: [{ key: 'logic', observed: true, score: 183 }, { key: 'expression', observed: true, score: '44.6' }],
    })
    expect(feedback.criteria.find(c => c.key === 'logic')?.score).toBe(100)
    expect(feedback.criteria.find(c => c.key === 'expression')?.score).toBe(45)
  })

  it('발언이 없으면 총점을 만들지 않는다', () => {
    const feedback = normalizeFeedback({ summary: '평가할 발언이 없습니다.', criteria: [] })
    expect(feedback.total).toBeNull()
    expect(feedback.criteria.every(c => c.score === null)).toBe(true)
  })

  it('고쳐 쓴 문장과 다음 단계, 꼬리질문을 정리한다', () => {
    const feedback = normalizeFeedback({
      rewrites: [{ original: '찬성합니다.', improved: '조건부로 찬성합니다.', why: '조건을 밝혔습니다.' }],
      nextSteps: ['상대 근거를 인용해 보세요.'],
      strengths: ['구조가 분명합니다.', 42],
      followUps: [
        { question: '왜 그 기준인가요?', intent: '기준의 근거 확인', points: ['기준', '근거'], quote: '찬성합니다.' },
        { question: '예외는요?' },
      ],
    })
    expect(feedback.rewrites[0].improved).toBe('조건부로 찬성합니다.')
    expect(feedback.nextSteps).toHaveLength(1)
    expect(feedback.strengths).toEqual(['구조가 분명합니다.'])
    expect(feedback.followUps).toHaveLength(2)
    expect(feedback.followUps?.[0].quote).toBe('찬성합니다.')
    expect(feedback.followUps?.[1].intent.length).toBeGreaterThan(3)
  })

  it('꼬리질문이 없으면 빈 배열이고, 부족하면 대체 질문으로 채운다', () => {
    expect(normalizeFollowUps(undefined)).toEqual([])
    const fallback = [{ question: '대체 질문', intent: '의도', points: ['p'] }]
    const filled = normalizeFollowUps([{ question: '첫 질문', intent: '의도', points: [] }], fallback, 3)
    expect(filled.map(item => item.question)).toEqual(['첫 질문', '대체 질문'])
  })
})

describe('데모 피드백', () => {
  it('내 발언 수와 결과물에 맞춰 다섯 기준과 꼬리질문 3개를 만든다', () => {
    const feedback = demoFeedback(
      {
        messages: userMessages,
        topic: practiceTopics[0],
        jointDeliverable: '[1. 우리 조의 합의 방향] 치료 목적만 허용하고 추가 관점을 반영해 예외를 둔다.',
      },
      1000,
    )
    expect(feedback.demo).toBe(true)
    expect(feedback.criteria).toHaveLength(5)
    expect(feedback.total).not.toBeNull()
    expect(feedback.createdAt).toBe(1000)
    expect(feedback.rewrites.length).toBeGreaterThan(0)
    expect(feedback.followUps).toHaveLength(3)
    expect(feedback.criteria.find(c => c.key === 'contribution')?.reason).toContain('공동 결과물')
  })

  it('발언이 하나도 없으면 점수를 비운다', () => {
    const feedback = demoFeedback({ messages: [] }, 2000)
    expect(feedback.total).toBeNull()
    expect(feedback.criteria.every(c => c.score === null)).toBe(true)
    expect(feedback.followUps).toHaveLength(3)
  })
})
