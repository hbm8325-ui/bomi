import { aiIds, nameOf } from '../data/participants'
import type { AIId, DebateTopic, Message, Stage } from '../types'
import { lensOf } from './perspectives'

const defaultPoints: Record<AIId, string[]> = {
  ai1: [
    '판단 기준을 하나로 정하고 시작하면 좋겠습니다. 기준이 다르면 같은 사례도 결론이 달라집니다.',
    '그 기준이 실제로 적용될 때 예외를 어디까지 둘지가 남습니다. 그 부분을 먼저 정리해 볼까요?',
  ],
  ai2: [
    '그 결정으로 현장에서 먼저 곤란해지는 사람이 누구인지 궁금합니다. 그 지점을 같이 보면 좋겠어요.',
    '기준은 맞아도 절차가 부담이면 지켜지기 어렵습니다. 당사자 의견을 한 번 들어야 합니다.',
  ],
  ai3: [
    '실행 순서를 정해야 합니다. 누가 언제까지 무엇을 맡는지 없으면 합의안이 문장으로만 남습니다.',
    '그 조건이면 비용이 어디로 가는지 정해야 합니다. 부담이 한쪽에 몰리면 유지되기 어렵습니다.',
  ],
}

const responseOpeners = [
  '그 말씀에서 조건이 중요한 게 보였습니다.',
  '방금 말씀에 한 가지만 더하겠습니다.',
  '그 지점은 조금 다르게 봤습니다.',
  '앞선 이야기와 연결해 보면,',
  '말씀하신 기준에 동의하는데,',
]

const stage3Openers = [
  '새로 나온 관점을 보면,',
  '추가 관점 때문에 1차 결론을 다시 봐야 할 것 같습니다.',
  '3단계 관점을 반영하면,',
]

const perspectiveHint = (topic: DebateTopic): string => {
  const text = topic.additionalPerspective ?? ''
  const first = text.split(/(?<=[?？])\s/)[0] ?? text
  return first.trim()
}

/** API 키 없이 4단계 흐름을 확인할 수 있는 데모 발언입니다. */
export function demoReply(options: {
  topic: DebateTopic
  speakerId: AIId
  messages: readonly Message[]
  stage: Stage
  mode?: 'basic' | 'deep'
}): string {
  const { topic, speakerId, messages, stage } = options
  const index = Math.max(0, aiIds.indexOf(speakerId))
  const lens = lensOf(speakerId).label
  const own = messages.filter(m => m.speakerId === speakerId)
  const stageMessages = messages.filter(m => m.stage === stage)
  const firstInStage = !stageMessages.some(m => m.speakerId === speakerId)
  const last = [...messages].reverse().find(m => m.speakerId !== 'user')
  const respondedToUser = [...messages].reverse()[0]?.speakerId === 'user'
  const guide = topic.modelGuide
  const point = topic.mockPoints?.[index] ?? defaultPoints[speakerId][own.length % 2]

  if (stage === 'stage3' && firstInStage) {
    const hint = perspectiveHint(topic)
    const tail =
      index === 2
        ? guide?.synthesisExample ?? '이 관점을 반영하면 예외 조건을 하나 더 정해야 합니다.'
        : `이 관점이 들어오면 ${index === 0 ? '기준의 우선순위' : '현장의 부담'}를 다시 조정해야 할 것 같습니다.`
    return [`${stage3Openers[own.length % stage3Openers.length]} ${hint}`, tail].join(' ')
  }

  if (firstInStage && stage === 'stage2') {
    if (index === 0 && guide?.openingExample) return guide.openingExample
    const opener = guide?.perspectives?.[index] ?? point
    return `${opener} 저는 ${lens} 쪽에서 먼저 이 기준을 확인하고 싶습니다.`
  }

  if (!last) {
    return `${point} 저는 ${lens} 쪽에서 이 지점을 먼저 확인하고 싶습니다.`
  }

  const opener = respondedToUser
    ? responseOpeners[messages.length % responseOpeners.length]
    : `${nameOf(last.speakerId)} 님 말도 들었습니다.`
  const extra =
    stage === 'stage3'
      ? `추가 관점까지 넣으면 합의안에 예외 조건을 한 줄 더해야 합니다.`
      : guide?.perspectives?.[index] ?? ''
  return [opener, point, extra].filter(Boolean).join(' ')
}

export const demoNotice = '데모 모드: 준비된 예시 발언입니다. 실제 AI 응답은 Gemini 키를 연결하면 생성됩니다.'
