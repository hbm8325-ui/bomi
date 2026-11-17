import { describe, expect, it } from 'vitest'
import { userReplyTarget } from '../src/logic/userReplyTarget'
import { flowDecision, isRepetition, nextSpeaker, trimRepetition } from '../src/logic/turn'
import type { Message } from '../src/types'

const msg = (id: string, speakerId: Message['speakerId'], text: string): Message => ({
  id,
  speakerId,
  text,
  turnId: Number(id.replace(/\D/g, '')) || 0,
  timestamp: 0,
  isUser: speakerId === 'user',
  source: speakerId === 'user' ? 'text' : 'real',
})

describe('사용자 발언 대상 추적', () => {
  it('이름을 부르며 질문하면 그 AI를 지목한다', () => {
    const history = [
      msg('1', 'ai1', '저는 AI가 최종 결정을 맡아도 된다고 봅니다.'),
      msg('2', 'ai2', '위험한 결정까지 맡길 수 있을까요?'),
      msg('3', 'user', '서연 님은 그 위험을 누가 판단해야 한다고 보세요?'),
    ]
    const target = userReplyTarget(history)
    expect(target?.speakerId).toBe('ai2')
    expect(target?.reason).toBe('named-question')
    expect(target?.claimMessageId).toBe('2')
  })

  it('이름 뒤에 님을 붙여도 찾는다', () => {
    const history = [
      msg('1', 'ai1', '검증된 범위에서라면 가능하다고 봅니다.'),
      msg('2', 'user', '민준 님은 그 범위를 누가 정한다고 보세요?'),
    ]
    expect(userReplyTarget(history)?.speakerId).toBe('ai1')
  })

  it('여러 사람에게 한꺼번에 물으면 지목하지 않는다', () => {
    const history = [
      msg('1', 'ai1', '찬성합니다.'),
      msg('2', 'ai2', '저는 다르게 봅니다.'),
      msg('3', 'user', '다른 분들 생각은 어떠세요?'),
    ]
    expect(userReplyTarget(history)).toBeNull()
  })

  it('직전 AI 주장을 가리키며 반박하면 직전 발언자를 고른다', () => {
    const history = [
      msg('1', 'ai1', '찬성합니다.'),
      msg('2', 'ai3', '비용 부담이 결국 현장 직원에게 갑니다.'),
      msg('3', 'user', '그 주장은 근거가 부족하지 않나요?'),
    ]
    const target = userReplyTarget(history)
    expect(target?.speakerId).toBe('ai3')
    expect(target?.reason).toBe('previous-claim')
  })

  it('단어가 뚜렷하게 겹치는 AI를 관련 발언자로 고른다', () => {
    const history = [
      msg('1', 'ai1', '성과급은 개인 기여를 측정해야 공정합니다. 측정 기준을 먼저 정해야 합니다.'),
      msg('2', 'ai2', '측정이 어려우면 협력한 사람이 손해를 봅니다.'),
      msg('3', 'user', '성과급 측정 기준이 모호하면 어떻게 하나요?'),
    ]
    const target = userReplyTarget(history)
    expect(target?.speakerId).toBe('ai1')
    expect(target?.reason).toBe('related-claim')
  })

  it('근거가 약하면 아무도 고르지 않는다', () => {
    const history = [
      msg('1', 'ai1', '찬성합니다.'),
      msg('2', 'ai2', '저는 다르게 봅니다.'),
      msg('3', 'user', '음, 조금 더 생각해 볼게요.'),
    ]
    expect(userReplyTarget(history)).toBeNull()
  })

  it('마지막 발언이 사용자가 아니면 대상이 없다', () => {
    const history = [msg('1', 'user', '찬성합니다.'), msg('2', 'ai1', '그 이유가 궁금합니다.')]
    expect(userReplyTarget(history)).toBeNull()
  })
})

describe('발언 순서와 흐름', () => {
  it('마지막 AI 다음 순서의 참가자가 이어서 말한다', () => {
    expect(nextSpeaker([msg('1', 'ai1', 'a')])).toBe('ai2')
    expect(nextSpeaker([msg('1', 'ai1', 'a'), msg('2', 'ai2', 'b')])).toBe('ai3')
    expect(nextSpeaker([msg('1', 'ai3', 'c')])).toBe('ai1')
    expect(nextSpeaker([])).toBe('ai1')
  })

  it('일반 토론은 사용자 발언마다 AI 한 명, 심화는 두 명이 답한다', () => {
    const opening = [msg('1', 'ai1', '첫 발언입니다.')]
    expect(flowDecision(opening, 'basic', false).reason).toBe('user-floor')
    const afterUser = [msg('1', 'ai1', 'a'), msg('2', 'user', '제 생각은 다릅니다.')]
    expect(flowDecision(afterUser, 'basic', false).continue).toBe(true)
    expect(flowDecision([...afterUser, msg('3', 'ai2', '반응입니다.')], 'basic', false).continue).toBe(false)
    expect(flowDecision([...afterUser, msg('3', 'ai2', '반응입니다.')], 'deep', false).continue).toBe(true)
  })

  it('추가 청취를 허용하면 한 번 더 이어간다', () => {
    const conversation = [msg('1', 'ai1', 'a'), msg('2', 'user', '제 생각입니다.'), msg('3', 'ai2', 'b')]
    expect(flowDecision(conversation, 'basic', false).continue).toBe(false)
    expect(flowDecision(conversation, 'basic', false, 1).continue).toBe(true)
  })

  it('종료했거나 예산을 넘으면 더 말하지 않는다', () => {
    expect(flowDecision([msg('1', 'ai1', 'a')], 'basic', true).reason).toBe('ended')
    const many = Array.from({ length: 20 }, (_, index) => msg(String(index + 1), 'ai1', `발언 ${index}`))
    expect(flowDecision(many, 'basic', false).reason).toBe('budget')
    const deepMany = Array.from({ length: 28 }, (_, index) => msg(String(index + 1), 'ai1', `발언 ${index}`))
    expect(flowDecision(deepMany, 'deep', false).reason).toBe('budget')
  })
})

describe('반복 발언 차단', () => {
  const previous = [msg('1', 'ai1', '검증된 범위에서라면 AI에게 결정을 맡길 수 있다고 봅니다. 책임 기준이 먼저 필요합니다.')]

  it('같은 문장을 그대로 반복하면 걸러낸다', () => {
    expect(isRepetition('검증된 범위에서라면 AI에게 결정을 맡길 수 있다고 봅니다. 책임 기준이 먼저 필요합니다.', previous)).toBe(true)
  })

  it('문장 하나를 덜어내 반복을 피한다', () => {
    const text = '검증된 범위에서라면 AI에게 결정을 맡길 수 있다고 봅니다. 책임 기준이 먼저 필요합니다. 다만 이의 제기 절차도 있어야 합니다.'
    const trimmed = trimRepetition(text, previous)
    expect(trimmed).toContain('이의 제기')
    expect(isRepetition(trimmed ?? '', previous)).toBe(false)
  })

  it('새 발언은 그대로 둔다', () => {
    const text = '저는 반대입니다. 책임 소재가 흐려지면 피해자가 생깁니다.'
    expect(trimRepetition(text, previous)).toBe(text)
  })
})
