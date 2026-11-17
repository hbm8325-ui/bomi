import type { DebateTopic } from '../../types'

/** 준비된 연습 주제를 만드는 도우미. 실제 기출이 아닌 연습용 창작 주제입니다. */
export function topic(input: {
  id: string
  category: string
  title: string
  situation?: string
  keyIssue?: string
  goal?: string
  additionalPerspective: string
  perspectives: readonly [string, string, string]
  openingExample: string
  synthesisExample: string
  jointDeliverableExample: string
  mockPoints: readonly [string, string, string]
}): DebateTopic {
  const context = {
    ...(input.situation ? { situation: input.situation } : {}),
    ...(input.keyIssue ? { keyIssue: input.keyIssue } : {}),
    ...(input.goal ? { goal: input.goal } : {}),
  }
  return {
    id: input.id,
    category: input.category,
    title: input.title,
    ...(Object.keys(context).length ? { context } : {}),
    source: 'prepared',
    additionalPerspective: input.additionalPerspective,
    modelGuide: {
      perspectives: input.perspectives,
      openingExample: input.openingExample,
      synthesisExample: input.synthesisExample,
      jointDeliverableExample: input.jointDeliverableExample,
    },
    mockPoints: input.mockPoints,
  }
}
