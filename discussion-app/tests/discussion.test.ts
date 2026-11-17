import { describe, expect, it } from 'vitest'
import { demoDraft, demoFollowUps, demoRehearsal, demoReview, normalizeLines } from '../src/logic/discussion'
import { estimateSpeech } from '../src/logic/speechRate'
import { practiceTopics } from '../src/data/topics'
import type { Message } from '../src/types'

const topic = practiceTopics[0]
const messages: Message[] = [
  { id: 'm1', speakerId: 'user', text: '저는 치료 목적과 편의 목적을 나눠서 기준을 정해야 한다고 봅니다.', turnId: 1, timestamp: 0, isUser: true, source: 'text', stage: 'stage2' },
  { id: 'm2', speakerId: 'ai2', text: '그 기준이면 고통이 큰 사람에게 절차가 부담이 될 수 있어요.', turnId: 2, timestamp: 0, isUser: false, source: 'real', stage: 'stage2' },
  { id: 'm3', speakerId: 'user', text: '그 부담은 삭제 전 상담을 한 번으로 줄여서 해결할 수 있습니다.', turnId: 3, timestamp: 0, isUser: true, source: 'text', stage: 'stage3' },
]

describe('공동 결과물 데모', () => {
  it('4개 항목을 모두 채운 초안을 만들고 내 메모를 반영한다', () => {
    const draft = demoDraft({ topic, messages, prepNotes: { position: '치료 목적 우선', evidence: '상담 사례', expectedViews: '비용 우려' } })
    expect(draft).toContain('[1. 우리 조의 합의 방향(결론)]')
    expect(draft).toContain('치료 목적 우선')
    expect(draft).toContain('상담 사례')
    expect(draft).toContain('[3. 추가 관점 반영 및 예외·보완 조건]')
    expect(draft).toContain('[4. 실행 방안 및 남은 과제]')
  })

  it('보완 피드백은 3줄로 나온다', () => {
    const lines = demoReview({ topic, draft: '[1. 우리 조의 합의 방향(결론)] 치료 목적만 허용한다.' })
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('빠진 관점')
    expect(lines[1]).toContain('약한 합의')
    expect(lines[2]).toContain('다음 문장')
  })

  it('방어 답변 코칭은 3줄이고 근거·놓친 지점을 짚는다', () => {
    const followUp = demoFollowUps({ topic, messages })[0]
    const lines = demoRehearsal({ followUp, defense: '결론부터 말씀드리면 예외는 인정하되 조건을 붙이겠습니다.' })
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('결론 먼저')
    expect(lines[1]).toContain('근거 보강')
    expect(lines[2]).toContain('놓친 지점')
  })

  it('꼬리질문 3개가 내 발언과 결과물을 실제로 인용한다', () => {
    const followUps = demoFollowUps({ topic, messages, jointDeliverable: '[1. 합의] 조건부 허용' })
    expect(followUps).toHaveLength(3)
    expect(followUps[0].quote).toContain('치료 목적')
    expect(followUps[2].question).toContain('실행')
    for (const item of followUps) {
      expect(item.intent.length).toBeGreaterThan(5)
      expect(item.points.length).toBeGreaterThan(0)
    }
  })

  it('모델이 준 줄을 3줄로 맞춘다', () => {
    expect(normalizeLines(['a', 'b'], ['c', 'd'])).toEqual(['a', 'b', 'c'])
    expect(normalizeLines(undefined, ['x'])).toEqual(['x', '', ''])
  })
})

describe('예상 발화 시간', () => {
  it('분당 300자 기준으로 초를 계산한다', () => {
    expect(estimateSpeech('').label).toBe('')
    expect(estimateSpeech('가'.repeat(150)).seconds).toBe(30)
    expect(estimateSpeech('가'.repeat(150)).label).toContain('적당해요')
    expect(estimateSpeech('가'.repeat(60)).label).toContain('조금 더')
    expect(estimateSpeech('가'.repeat(380)).label).toContain('줄이면')
    expect(estimateSpeech('가'.repeat(380)).label).toContain('1분')
  })
})
