import { aiIds, participants } from '../data/participants'
import type { AIId } from '../types'

export type ReplySource = { id: string; speakerId: string; text: string }

export type UserReplyTarget = {
  speakerId: AIId
  userMessageId: string
  claimMessageId: string | null
  reason: 'named-question' | 'previous-claim' | 'related-claim'
}

const isAI = (id: string): id is AIId => aiIds.some(ai => ai === id)

const questionOrChallenge =
  /[?？]|어떻게|왜|무엇|누가|어떤|무슨|질문|묻고\s*싶|설명해|답해|답변해|알려\s*주세요|(?:나요|까요|습니까|하죠|되죠|맞죠)[.!\s]*$|동의하지|동의하기\s*어렵|반대합니다|반대해요|모순|근거가\s*부족|그렇지\s*않/u

const groupQuestion =
  /(?:다른|나머지)\s*(?:분들?|참가자들?|AI들?).{0,12}(?:생각|의견|답|말씀|어떻게)|여러분|다들|(?:세|두)\s*분|모두.{0,8}(?:어떻게|생각|의견)|전체(?:에게|의\s*의견)/iu

const previousReference =
  /(?:방금|직전|앞서).*(?:주장|말씀|의견)|(?:그|이)\s*(?:주장|말씀|논리|의견|방법|방안|조건|경우)|^(?:(?:그럼|그러면|그렇다면)\s*(?:어떻게|왜|누가|무슨|어떤)|왜요|왜죠|무슨\s*뜻)/u

const continuation = /^(?:그런데|근데|그럼|그렇다면|그러면|하지만|그러나)/u

const ignoredTerms = new Set([
  '저는', '제가', '우리', '그것', '이것', '그런데', '근데', '그럼', '그렇다면', '그러면', '하지만',
  '어떻게', '무엇', '누가', '어떤', '무슨', '생각', '생각합니다', '생각해요', '중요합니다', '중요해요',
  '필요합니다', '필요해요', '있습니다', '있어요', '없습니다', '없어요', '합니다', '해야', '대한',
  '때문', '경우', '주장', '말씀', '의견', ...participants.map(p => p.name),
])

function terms(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[가-힣a-z0-9]{2,}/gu) ?? []).map(word => {
      const stem = word.replace(
        /(?:으로는|에서는|에게는|에서|으로|에게|보다|처럼|까지|은|는|이|가|을|를|도|만|의|와|과)$/u,
        '',
      )
      return stem.length >= 2 ? stem : word
    }).filter(word => !ignoredTerms.has(word)),
  )
}

const overlap = (a: Set<string>, b: Set<string>) => [...a].filter(word => b.has(word))

/**
 * 사용자 발언이 누구에게 향한 것인지 보수적으로 판단합니다.
 * 이름 호명 + 질문/반론이면 그 AI, 직전 발언에 대한 질문이면 직전 AI,
 * 최근 발언과 단어가 뚜렷하게 겹칠 때만 관련 AI를 고르고, 애매하면 null을 돌려줍니다.
 */
export function userReplyTarget(
  history: readonly ReplySource[],
  hints: readonly { messageId: string; words: string }[] = [],
): UserReplyTarget | null {
  const user = history.at(-1)
  if (user?.speakerId !== 'user' || groupQuestion.test(user.text)) return null
  const earlier = history.slice(0, -1)
  const claims = earlier.filter(m => isAI(m.speakerId))
  const target = (
    speakerId: AIId,
    reason: UserReplyTarget['reason'],
    claim = claims.findLast(m => m.speakerId === speakerId),
  ): UserReplyTarget => ({ speakerId, reason, userMessageId: user.id, claimMessageId: claim?.id ?? null })

  const named = aiIds.filter(id => {
    const person = participants.find(p => p.id === id)!
    return new RegExp(
      `${person.name}|${person.name.slice(1)}\\s*(?:님|씨)|AI\\s*${id.slice(-1)}(?![0-9])(?:번)?`,
      'iu',
    ).test(user.text)
  })
  if (named.length > 1) return null
  if (named.length === 1 && questionOrChallenge.test(user.text)) return target(named[0], 'named-question')

  const userTerms = terms(user.text)
  const last = claims.at(-1)
  const shared = last ? overlap(userTerms, terms(last.text)).length : 0
  if (
    last &&
    questionOrChallenge.test(user.text) &&
    (previousReference.test(user.text.trim()) ||
      (continuation.test(user.text.trim()) && shared >= 1) ||
      shared >= 2)
  ) {
    return target(last.speakerId as AIId, 'previous-claim', last)
  }

  // 최근 실제 발언만 대상으로 합니다. 저장된 요약이 없는 발언자를 새로 만들지 않습니다.
  const evidence = aiIds.map(speakerId => {
    const recent = claims.filter(m => m.speakerId === speakerId).slice(-3)
    const scored = recent
      .map(claim => {
        const hint = hints.find(h => h.messageId === claim.id && hintsSpeaker(claims, claim.id, speakerId))
        const words = terms([claim.text, hint?.words].filter(Boolean).join(' '))
        return { claim, matches: overlap(userTerms, words) }
      })
      .sort((a, b) => b.matches.length - a.matches.length)
    return { speakerId, claim: scored[0]?.claim, matches: scored[0]?.matches ?? [] }
  })
  const ranked = evidence
    .map(item => ({
      ...item,
      score: item.matches.reduce((sum, word) => {
        const speakers = evidence.filter(e => e.matches.includes(word)).length
        return sum + (speakers === 1 ? 2 : speakers === 2 ? 1 : 0)
      }, 0),
    }))
    .sort((a, b) => b.score - a.score)
  const [best, second] = ranked
  return best.matches.length >= 2 && best.score >= 3 && best.score - second.score >= 2
    ? target(best.speakerId, 'related-claim', best.claim)
    : null
}

const hintsSpeaker = (claims: readonly ReplySource[], id: string, speakerId: string) =>
  claims.some(m => m.id === id && m.speakerId === speakerId)
