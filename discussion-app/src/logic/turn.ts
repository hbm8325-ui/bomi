import { aiIds } from '../data/participants'
import type { AIId, DebateMode, Message } from '../types'
import { userReplyTarget, type UserReplyTarget } from './userReplyTarget'

export const turnBudget: Record<DebateMode, { perUserTurn: number; maxAiTurns: number }> = {
  basic: { perUserTurn: 1, maxAiTurns: 20 },
  deep: { perUserTurn: 2, maxAiTurns: 28 },
}

export const paceDelay: Record<'relaxed' | 'normal' | 'fast', number> = {
  relaxed: 5200,
  normal: 2600,
  fast: 900,
}

/** 사용자 발언 뒤 누가 이어서 말할지 정합니다. 사용자가 지목하면 그 AI가 우선합니다. */
export function nextSpeaker(
  messages: readonly Message[],
  reply: UserReplyTarget | null = userReplyTarget(messages),
): AIId {
  if (reply) return reply.speakerId
  const lastAi = [...messages].reverse().find(m => m.speakerId !== 'user')
  if (!lastAi) return aiIds[0]
  const index = aiIds.indexOf(lastAi.speakerId as AIId)
  return aiIds[(index + 1) % aiIds.length]
}

/** 마지막 사용자 발언 이후 AI가 몇 번 말했는지 셉니다. */
export function aiTurnsSinceUser(messages: readonly Message[]): number {
  let count = 0
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.speakerId === 'user') break
    count += 1
  }
  return count
}

/** 다음 AI 발언을 자동으로 이어갈지 판단하고, 이유를 함께 돌려줍니다. */
export function flowDecision(
  messages: readonly Message[],
  mode: DebateMode,
  ended: boolean,
  extraTurns = 0,
): { continue: boolean; reason: 'idle' | 'user-turn' | 'user-floor' | 'budget' | 'ended' } {
  if (ended) return { continue: false, reason: 'ended' }
  if (!messages.length) return { continue: true, reason: 'idle' }
  const budget = turnBudget[mode]
  const aiCount = messages.filter(m => m.speakerId !== 'user').length
  if (aiCount >= budget.maxAiTurns) return { continue: false, reason: 'budget' }
  const sinceUser = aiTurnsSinceUser(messages)
  if (sinceUser >= budget.perUserTurn + Math.max(0, extraTurns)) return { continue: false, reason: 'user-floor' }
  return { continue: true, reason: 'user-turn' }
}

const normalizeText = (text: string) => text.replace(/\s+/g, '').replace(/[.,!?~"'“”‘’]/g, '')

/** 같은 발언을 그대로 반복했는지 확인합니다(원본 저장소의 REPETITION 검사와 같은 규칙). */
export function isRepetition(text: string, previous: readonly Message[]): boolean {
  const plain = normalizeText(text)
  if (plain.length < 12) return false
  return previous.some(m => {
    const old = normalizeText(m.text)
    return old === plain || (old.length > 80 && plain.includes(old))
  })
}

/** 이미 나온 문장을 덜어내고 새 내용만 남깁니다. 남는 내용이 없으면 null입니다. */
export function trimRepetition(text: string, previous: readonly Message[]): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const fresh = sentences.filter(sentence => {
    const normalized = normalizeText(sentence)
    if (normalized.length < 12) return true
    return !previous.some(m => normalizeText(m.text).includes(normalized))
  })
  const joined = fresh.join(' ').trim()
  if (!joined) return null
  return isRepetition(joined, previous) ? null : joined
}
