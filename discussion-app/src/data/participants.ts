import type { AIId, Participant } from '../types'

/** 그룹 토의 팀원 3명. 고정된 찬반 진영이 아니라 각자의 관점(렌즈)으로 참여합니다. */
export const participants: Participant[] = [
  { id: 'user', name: '나', initials: '나', role: '지원자', description: '내 관점과 합의안 정리' },
  { id: 'ai1', name: '민준', initials: '민준', role: '원칙·본질', description: '판단 기준과 전제를 점검' },
  { id: 'ai2', name: '서연', initials: '서연', role: '사람·현장', description: '사람과 현장에 미치는 영향' },
  { id: 'ai3', name: '도현', initials: '도현', role: '현실·조율', description: '실행 순서와 이해관계자 조율' },
]

export const aiIds: AIId[] = ['ai1', 'ai2', 'ai3']

export const nameOf = (id: string): string =>
  participants.find(p => p.id === id)?.name ?? '참가자'
