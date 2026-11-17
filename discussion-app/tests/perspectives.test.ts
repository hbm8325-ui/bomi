import { describe, expect, it } from 'vitest'
import { practiceTopics } from '../src/data/topics'
import { lensOf, prepNotesSummary, stageInstruction, styleInstruction } from '../src/logic/perspectives'
import { nextStageOf, previousStageOf, stageInfo, stageList } from '../src/logic/stages'

describe('4단계 진행표', () => {
  it('5·10·15·10분 네 단계로 총 40분이다', () => {
    expect(stageList.map(item => item.minutes)).toEqual([5, 10, 15, 10])
    expect(stageList.reduce((sum, item) => sum + item.minutes, 0)).toBe(40)
    expect(stageList.map(item => item.number)).toEqual([1, 2, 3, 4])
  })

  it('단계 이동이 순서대로 이어진다', () => {
    expect(nextStageOf('stage1')).toBe('stage2')
    expect(nextStageOf('stage3')).toBe('stage4')
    expect(nextStageOf('stage4')).toBeNull()
    expect(previousStageOf('stage3')).toBe('stage2')
    expect(previousStageOf('stage1')).toBeNull()
    expect(stageInfo('stage3').label).toContain('추가 관점')
  })
})

describe('그룹 토의 관점 배정', () => {
  it('세 참가자가 찬반 진영이 아니라 서로 다른 렌즈를 맡는다', () => {
    expect(lensOf('ai1').label).toBe('원칙·본질')
    expect(lensOf('ai2').label).toBe('사람·현장 영향')
    expect(lensOf('ai3').label).toBe('현실·조율·실행')
    const labels = new Set([lensOf('ai1').label, lensOf('ai2').label, lensOf('ai3').label])
    expect(labels.size).toBe(3)
  })

  it('합의·조율 성향은 정답을 정하는 것이 목적이 아니라고 지시한다', () => {
    expect(styleInstruction('consensus')).toContain('합의')
    expect(styleInstruction('debate')).toContain('찬반')
  })

  it('3단계 지시에는 그 주제의 추가 관점이 실제로 들어간다', () => {
    const topic = practiceTopics[0]
    const instruction = stageInstruction('stage3', topic)
    expect(instruction).toContain(topic.additionalPerspective!.slice(0, 20))
    expect(instruction).toContain('추가 관점')
    expect(stageInstruction('stage2', topic)).not.toContain('추가 관점이 공개')
  })

  it('1단계 준비 메모를 한 줄로 요약한다', () => {
    expect(prepNotesSummary({ position: '기준은 안전', evidence: '사고 사례', expectedViews: '비용 우려' })).toBe(
      '내 입장·기준: 기준은 안전 / 주요 근거: 사고 사례 / 예상되는 다른 관점: 비용 우려',
    )
    expect(prepNotesSummary({ position: '', evidence: '', expectedViews: '' })).toBeNull()
    expect(prepNotesSummary(null)).toBeNull()
  })
})
