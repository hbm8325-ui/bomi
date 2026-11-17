import { describe, expect, it } from 'vitest'
import {
  BUILTIN_SCENARIOS,
  countByDifficulty,
  difficultyOf,
  difficultyRank,
  resourceToText,
  scenarioNumbers,
  scenarioResourcesText,
} from '../src/data/scenarios'
import { SCORE_MAX } from '../src/logic/prompts'
import { ANSWER_SKELETON } from '../src/data/skeleton'
import { countChars, formatClock } from '../src/logic/text'

const countModelChars = (text: string) => Array.from(text).length

describe('내장 시나리오 16세트 무결성', () => {
  it('과제 16개가 있고 id/과제번호가 서로 다르다', () => {
    expect(BUILTIN_SCENARIOS).toHaveLength(16)
    expect(new Set(BUILTIN_SCENARIOS.map(s => s.id)).size).toBe(16)
    expect(new Set(BUILTIN_SCENARIOS.map(s => s.code)).size).toBe(16)
  })

  it('입문 6 · 보통 6 · 심화 4 순서로 정렬되어 있다', () => {
    expect(countByDifficulty(BUILTIN_SCENARIOS)).toEqual({ 입문: 6, 보통: 6, 심화: 4 })
    const ranks = BUILTIN_SCENARIOS.map(difficultyRank)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    expect(BUILTIN_SCENARIOS[0].code).toBe('과제 1')
    expect(BUILTIN_SCENARIOS[0].difficulty).toBe('입문')
    expect(BUILTIN_SCENARIOS[5].difficulty).toBe('입문')
    expect(BUILTIN_SCENARIOS[6].difficulty).toBe('보통')
    expect(BUILTIN_SCENARIOS[11].difficulty).toBe('보통')
    expect(BUILTIN_SCENARIOS[15].code).toBe('과제 16')
    expect(BUILTIN_SCENARIOS[15].difficulty).toBe('심화')
  })

  it('기존 s1~s4는 id를 유지하고 과제 13~16으로 옮겨졌다', () => {
    expect(BUILTIN_SCENARIOS.slice(12).map(s => s.id)).toEqual([
      's1-pr-oel',
      's2-etch-exhaust',
      's3-special-exam',
      's4-solvent-ai',
    ])
    expect(BUILTIN_SCENARIOS.slice(12).map(s => s.code)).toEqual(['과제 13', '과제 14', '과제 15', '과제 16'])
  })

  it('신규 12개는 공학 계산이 아니라 상황 판단 중심이다', () => {
    const newOnes = BUILTIN_SCENARIOS.slice(0, 12)
    expect(newOnes.map(s => s.id)).toEqual([
      's5-night-shift-complaint',
      's6-unapproved-chemical',
      's7-cleanroom-ppe',
      's8-splash-late-report',
      's9-permit-checklist',
      's10-ehs-chatbot',
      's11-reproductive-solvent',
      's12-exam-privacy',
      's13-risk-assessment-schedule',
      's14-shift-health-program',
      's15-ehs-budget',
      's16-mixed-workforce-training',
    ])
    for (const scenario of newOnes) {
      expect(scenario.mission).toContain('3,000자')
      expect(`${scenario.mission} ${scenario.constraints.join(' ')}`).not.toMatch(/몰분율|총소유비용|TCO|ppm↔|환산하여/)
    }
  })

  it.each(BUILTIN_SCENARIOS.map(s => [s.code, s] as const))('%s: 필수 필드와 자료 2종·표·함정을 갖춘다', (_code, scenario) => {
    expect(scenario.title.length).toBeGreaterThan(10)
    expect(scenario.background.length).toBeGreaterThan(60)
    expect(scenario.mission).toContain('3,000자')
    expect(scenario.constraints.length).toBeGreaterThanOrEqual(3)
    expect(scenario.resources).toHaveLength(2)
    expect(['입문', '보통', '심화']).toContain(difficultyOf(scenario))
    for (const resource of scenario.resources) {
      expect(resource.title.endsWith('.pdf')).toBe(true)
      expect(resource.blocks.length).toBeGreaterThan(2)
      const tables = resource.blocks.filter(block => block.kind === 'table')
      expect(tables.length).toBeGreaterThanOrEqual(1)
      for (const block of tables) {
        if (block.kind !== 'table') continue
        expect(block.table.rows.length).toBeGreaterThanOrEqual(3)
        for (const row of block.table.rows) {
          expect(row).toHaveLength(block.table.head.length)
        }
      }
    }
    expect(scenario.traps.length).toBeGreaterThanOrEqual(2)
    for (const trap of scenario.traps) {
      expect(trap.keywords.length).toBeGreaterThanOrEqual(2)
      expect(trap.detail.length).toBeGreaterThan(40)
    }
  })

  it.each(BUILTIN_SCENARIOS.map(s => [s.code, s] as const))('%s: 자료 평문에 표와 단위가 살아 있다', (_code, scenario) => {
    const text = scenarioResourcesText(scenario)
    expect(text).toContain('|')
    expect(text).toMatch(/ppm|mg\/m³|m\/s|mmHg|억|%|건|명/)
    expect(text.length).toBeGreaterThan(1200)
  })

  it.each(BUILTIN_SCENARIOS.map(s => [s.code, s] as const))('%s: 모범답안이 제출용 분량과 구성으로 있다', (_code, scenario) => {
    const model = scenario.modelAnswer
    expect(model).toBeTruthy()
    if (!model) return
    const chars = countModelChars(model.report)
    expect(chars).toBeGreaterThanOrEqual(900)
    expect(chars).toBeLessThanOrEqual(1400)
    expect(model.points).toHaveLength(3)
    expect(model.samplePrompts.length).toBeGreaterThanOrEqual(2)
    expect(model.samplePrompts.length).toBeLessThanOrEqual(3)
    for (const point of model.points) expect(point.length).toBeGreaterThan(30)
    for (const prompt of model.samplePrompts) expect(prompt.length).toBeGreaterThan(15)
    // 결론이 앞에 오는 두괄식인지: 첫 40자 안에 결론 신호가 있어야 한다.
    expect(model.report.slice(0, 60)).toMatch(/결론|우선|먼저|하겠습니다|제안|택/)
  })

  it('내장 과제·모범답안에 개인정보가 없다', () => {
    const dump = BUILTIN_SCENARIOS.map(s =>
      [
        s.title,
        s.background,
        s.mission,
        scenarioResourcesText(s),
        s.traps.map(t => t.detail).join(' '),
        s.modelAnswer?.report ?? '',
        s.modelAnswer?.points.join(' ') ?? '',
        s.modelAnswer?.samplePrompts.join(' ') ?? '',
      ].join('\n'),
    ).join('\n')
    // 검사 대상 문자열 자체가 저장소에 남지 않도록 코드포인트/분절 조합으로 만든다.
    const cp = (...codes: number[]) => String.fromCodePoint(...codes)
    expect(dump).not.toContain(cp(0xd55c, 0xbcf4, 0xbbf8))
    expect(dump).not.toContain(['bom2', '_h'].join(''))
    expect(dump).not.toContain(['5236', '-8325'].join(''))
    expect(dump).not.toContain(cp(0xc0bc, 0xc131) + 'SDI')
    expect(dump).not.toContain(['bomi', '929'].join(''))
  })

  it('자료의 숫자 토큰을 인용 검사용으로 뽑아낸다', () => {
    for (const scenario of BUILTIN_SCENARIOS) {
      const numbers = scenarioNumbers(scenario)
      expect(numbers.length).toBeGreaterThan(5)
    }
  })

  it('자료 하나를 텍스트로 직렬화하면 라벨·제목·표가 포함된다', () => {
    const text = resourceToText(BUILTIN_SCENARIOS[0].resources[0])
    expect(text).toContain('[자료 1]')
    expect(text).toContain('|')
    expect(text.length).toBeGreaterThan(300)
  })

  it('배점 합계는 100점이다', () => {
    const sum = Object.values(SCORE_MAX).reduce((acc, value) => acc + value, 0)
    expect(sum).toBe(100)
  })
})

describe('글자수·시간 표기', () => {
  it('공백 포함 글자수를 센다', () => {
    expect(countChars('abc def')).toBe(7)
    expect(countChars('')).toBe(0)
  })

  it('이모지를 1자로 센다', () => {
    expect(countChars('가😀')).toBe(2)
  })

  it('뼈대 틀은 비어 있는 5개 섹션을 제공한다', () => {
    expect(ANSWER_SKELETON).toContain('[결론 요약]')
    expect(ANSWER_SKELETON).toContain('[리스크·실행계획]')
    expect(countChars(ANSWER_SKELETON)).toBeLessThan(300)
  })

  it('타이머를 mm:ss로 표기한다', () => {
    expect(formatClock(2100)).toBe('35:00')
    expect(formatClock(300)).toBe('05:00')
    expect(formatClock(-5)).toBe('00:00')
  })
})
