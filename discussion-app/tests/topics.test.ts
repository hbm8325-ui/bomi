import { describe, expect, it } from 'vitest'
import { practiceTopics } from '../src/data/topics'

const excludedIds = [
  'tech-automation',
  'tech-connection',
  'social-success',
  'social-tradition',
  'social-service',
  'environment-consumption',
  'environment-nature',
  'cooperation-competition',
  'future-income',
  'future-longevity',
  'future-progress',
  'freedom-forgetting',
]

describe('그룹 토의 준비 주제', () => {
  it('28개 주제가 8개 카테고리에 있고 id가 겹치지 않는다', () => {
    expect(practiceTopics).toHaveLength(28)
    expect(new Set(practiceTopics.map(topic => topic.id)).size).toBe(28)
    expect(new Set(practiceTopics.map(topic => topic.category)).size).toBe(8)
  })

  it('찬반 대립형·추상 가치 논쟁 주제는 제외되어 있다', () => {
    const ids = practiceTopics.map(topic => topic.id)
    for (const id of excludedIds) expect(ids, id).not.toContain(id)
  })

  it('모든 주제가 합의·결과물 도출이 자연스러운 토의 문장과 상황을 갖는다', () => {
    for (const topic of practiceTopics) {
      expect(topic.title.length, topic.id).toBeGreaterThan(15)
      expect(topic.title.endsWith('?'), topic.title).toBe(true)
      expect(topic.title, topic.title).toMatch(/어떻게|기준|무엇|어떤/)
      expect(topic.title).not.toContain('찬성')
      expect(topic.category.length).toBeGreaterThan(0)
      expect(topic.source).toBe('prepared')
      expect(topic.context?.situation?.length ?? 0, topic.id).toBeGreaterThan(20)
      expect(topic.context?.keyIssue?.length ?? 0, topic.id).toBeGreaterThan(5)
      expect(topic.context?.goal?.length ?? 0, topic.id).toBeGreaterThan(5)
    }
  })

  it('모든 주제에 3단계 추가 관점(상황 + 핵심 질문)이 있다', () => {
    for (const topic of practiceTopics) {
      const perspective = topic.additionalPerspective ?? ''
      expect(perspective.length, topic.id).toBeGreaterThan(40)
      expect(perspective, topic.id).toMatch(/\?/)
      expect(perspective, topic.id).not.toBe(topic.context?.keyIssue)
    }
  })

  it('모든 주제에 모범 토의 & 결과물 가이드가 있다', () => {
    for (const topic of practiceTopics) {
      const guide = topic.modelGuide
      expect(guide, topic.id).toBeTruthy()
      expect(guide!.perspectives, topic.id).toHaveLength(3)
      for (const line of guide!.perspectives) expect(line.length, topic.id).toBeGreaterThan(20)
      expect(guide!.openingExample.length, topic.id).toBeGreaterThan(40)
      expect(guide!.synthesisExample.length, topic.id).toBeGreaterThan(20)
      const deliverable = guide!.jointDeliverableExample
      expect(deliverable, topic.id).toContain('[1.')
      expect(deliverable, topic.id).toContain('[2.')
      expect(deliverable, topic.id).toContain('[3.')
      expect(deliverable, topic.id).toContain('[4.')
      expect(deliverable.length, topic.id).toBeGreaterThan(120)
    }
  })

  it('AI 세 명의 데모 발언 재료(mockPoints)가 모두 준비되어 있다', () => {
    for (const topic of practiceTopics) {
      expect(topic.mockPoints, topic.id).toHaveLength(3)
      for (const point of topic.mockPoints ?? []) expect(point.length).toBeGreaterThan(10)
    }
  })
})
