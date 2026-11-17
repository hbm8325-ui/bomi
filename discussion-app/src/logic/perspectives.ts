import type { AIId, DebateTopic, DiscussionStyle, Stage } from '../types'
import { nameOf } from '../data/participants'

/**
 * 그룹 토의 관점 배정 — 찬반 진영을 나누지 않고, 세 사람이 서로 다른 렌즈로 같은 문제를 봅니다.
 * 실제 다수 의견이나 정답을 뜻하지 않는 연습용 배정입니다.
 */
export const lensBySpeaker: Record<AIId, { key: 'principle' | 'people' | 'reality'; label: string; description: string }> = {
  ai1: {
    key: 'principle',
    label: '원칙·본질',
    description: '무엇을 기준으로 판단할지, 원칙과 전제가 흔들리지 않는지 먼저 봅니다.',
  },
  ai2: {
    key: 'people',
    label: '사람·현장 영향',
    description: '그 결정이 실제 사람과 현장에 어떤 영향을 주는지, 누가 더 불리해지는지 살핍니다.',
  },
  ai3: {
    key: 'reality',
    label: '현실·조율·실행',
    description: '실행 순서와 비용, 이해관계자 조율, 남는 부담까지 따져 실행안으로 연결합니다.',
  },
}

export function lensOf(speakerId: AIId) {
  return lensBySpeaker[speakerId] ?? lensBySpeaker.ai1
}

/** 토의 성향 한 줄 */
export const styleLabel: Record<DiscussionStyle, string> = {
  consensus: '합의·조율 토의',
  debate: '찬반 집중 토론',
}

export function styleInstruction(style: DiscussionStyle): string {
  if (style === 'debate') {
    return '이번 연습은 찬반 집중 모드입니다. 자기 결론을 분명히 말하고 반대 근거를 적극적으로 검토하되, 진영을 고정하지 말고 근거가 바뀌면 결론도 조정하세요. 마지막에는 합의 가능한 지점을 남기세요.'
  }
  return '이번 연습은 합의·조율 토의입니다. 정답을 정하는 것이 목적이 아니라, 서로 다른 관점에서 공통 기준을 찾고 조율 가능한 합의안을 만드는 것이 목적입니다. 상대를 이기려 하지 말고 조건과 예외를 좁혀 가세요.'
}

/** 이 단계에서 이 참가자가 해야 할 일 */
export function stageInstruction(stage: Stage, topic: DebateTopic): string {
  if (stage === 'stage1') {
    return '아직 발언하지 않습니다. 사용자가 개인 의견을 준비하는 시간입니다.'
  }
  if (stage === 'stage2') {
    return '1차 토의 중입니다. 내 렌즈에서 판단 기준과 우선순위를 제시하고, 다른 참가자의 기준과 겹치는 지점·다른 지점을 확인하세요. 아직 최종 결론을 확정하지 말고, 합의 가능한 기준을 2~3개 모으는 데 집중하세요.'
  }
  if (stage === 'stage3') {
    if (!topic.additionalPerspective?.trim()) {
      return '2차 토의 중입니다. 이 주제에는 별도 추가 관점이 없으니, 지금까지 논의에서 아직 정하지 못한 조건·예외·우선순위를 새로운 관점처럼 다시 점검하세요. 1차 토의의 결론이 유지되는지 수정되는지 분명히 밝혀야 합니다.'
    }
    return `2차 토의 중입니다. 3단계 추가 관점이 공개되었습니다: "${topic.additionalPerspective}". 이 관점을 반드시 언급하고, 1차 토의에서 합의한 기준·결론이 이 관점 때문에 어떻게 바뀌는지(유지·수정·예외 추가)를 구체적으로 다루세요. 추가 관점을 무시한 발언은 인정되지 않습니다.`
  }
  return '4단계 공동 결과물 작성 중입니다. 자유 발언 대신 결과물 문장을 다듬는 데 집중합니다.'
}

/** 렌즈별 발언 지침 */
export function perspectiveInstruction(_topic: DebateTopic, speakerId: AIId, style: DiscussionStyle): string {
  const lens = lensOf(speakerId)
  const peer1 = nameOf(speakerId === 'ai1' ? 'ai2' : 'ai1')
  const peer2 = nameOf(speakerId === 'ai3' ? 'ai2' : 'ai3')
  return [
    `당신의 관점은 '${lens.label}'입니다. ${lens.description}`,
    `${peer1}·${peer2} 님과 같은 결론을 말해도 되지만, 같은 이유를 반복하지 말고 서로 다른 지점을 보태세요.`,
    '다른 참가자가 이미 인정한 부분은 한 줄로 확인하고, 아직 정해지지 않은 조건·예외·우선순위로 넘어가세요.',
    styleInstruction(style),
  ].join('\n')
}

/** 1단계 준비 메모를 AI가 참고할 수 있게 요약합니다. */
export function prepNotesSummary(
  notes: { position: string; evidence: string; expectedViews: string } | null | undefined,
): string | null {
  if (!notes) return null
  const parts = [
    notes.position.trim() ? `내 입장·기준: ${notes.position.trim()}` : '',
    notes.evidence.trim() ? `주요 근거: ${notes.evidence.trim()}` : '',
    notes.expectedViews.trim() ? `예상되는 다른 관점: ${notes.expectedViews.trim()}` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : null
}
