import type { Difficulty, Resource, ResourceBlock, Scenario } from '../../types'
import { scenario1 } from './s1'
import { scenario2 } from './s2'
import { scenario3 } from './s3'
import { scenario4 } from './s4'
import { scenario5 } from './s5'
import { scenario6 } from './s6'
import { scenario7 } from './s7'
import { scenario8 } from './s8'
import { scenario9 } from './s9'
import { scenario10 } from './s10'
import { scenario11 } from './s11'
import { scenario12 } from './s12'
import { scenario13 } from './s13'
import { scenario14 } from './s14'
import { scenario15 } from './s15'
import { scenario16 } from './s16'

/**
 * 내장 16세트. 정렬은 입문(과제 1~6) → 보통(과제 7~12) → 심화(기존 s1~s4, 과제 13~16).
 * 기존 s1~s4의 id는 기록 호환을 위해 그대로 유지하고 code만 과제 13~16으로 옮겼습니다.
 */
export const BUILTIN_SCENARIOS: Scenario[] = [
  scenario5,
  scenario6,
  scenario7,
  scenario8,
  scenario9,
  scenario10,
  scenario11,
  scenario12,
  scenario13,
  scenario14,
  scenario15,
  scenario16,
  scenario1,
  scenario2,
  scenario3,
  scenario4,
]

export const DIFFICULTIES: Difficulty[] = ['입문', '보통', '심화']

const DIFFICULTY_ORDER: Record<Difficulty, number> = { 입문: 0, 보통: 1, 심화: 2 }

/** 난이도 값이 없으면 '심화'로 간주(기존 사용자 과제 호환) */
export function difficultyOf(scenario: Scenario): Difficulty {
  return scenario.difficulty ?? '심화'
}

export function difficultyRank(scenario: Scenario): number {
  return DIFFICULTY_ORDER[difficultyOf(scenario)]
}

/** CSS 클래스용 영문 키 */
export function difficultySlug(level: Difficulty): string {
  return level === '입문' ? 'intro' : level === '보통' ? 'normal' : 'deep'
}

export function countByDifficulty(scenarios: Scenario[]): Record<Difficulty, number> {
  const counts: Record<Difficulty, number> = { 입문: 0, 보통: 0, 심화: 0 }
  for (const scenario of scenarios) counts[difficultyOf(scenario)] += 1
  return counts
}

export function findBuiltin(id: string): Scenario | undefined {
  return BUILTIN_SCENARIOS.find(s => s.id === id)
}

/** 자료 한 건을 AI 컨텍스트/복사용 평문으로 직렬화합니다(표는 파이프 표기). */
export function resourceToText(resource: Resource): string {
  const lines: string[] = []
  lines.push(`[${resource.label}] ${resource.title}`)
  if (resource.meta) lines.push(`(${resource.meta})`)
  lines.push('')
  for (const block of resource.blocks) {
    lines.push(blockToText(block))
  }
  if (resource.footnote) lines.push('', resource.footnote)
  return lines.join('\n').trim()
}

export function blockToText(block: ResourceBlock): string {
  if (block.kind === 'text') return block.text
  if (block.kind === 'bullets') return block.items.map(item => `- ${item}`).join('\n')
  const { table } = block
  const out: string[] = []
  if (table.caption) out.push(table.caption)
  out.push('| ' + table.head.join(' | ') + ' |')
  out.push('| ' + table.head.map(() => '---').join(' | ') + ' |')
  for (const row of table.rows) out.push('| ' + row.join(' | ') + ' |')
  if (table.note) out.push(table.note)
  return out.join('\n')
}

export function scenarioResourcesText(scenario: Scenario): string {
  return scenario.resources.map(resourceToText).join('\n\n')
}

/** 답안/대화에서 '자료에 있는 수치'를 인용했는지 확인할 때 쓰는 숫자 토큰 집합. */
export function scenarioNumbers(scenario: Scenario): string[] {
  const raw = scenarioResourcesText(scenario)
  const set = new Set<string>()
  const matches = raw.match(/\d+(?:[.,]\d+)?/g) ?? []
  for (const m of matches) {
    const normalized = m.replace(/,/g, '')
    if (normalized.length >= 2) set.add(normalized)
  }
  return [...set]
}

export function scenarioSearchText(scenario: Scenario): string {
  return [
    scenario.title,
    scenario.field,
    scenario.difficulty ?? '',
    scenario.background,
    scenario.mission,
    scenario.constraints.join(' '),
    scenarioResourcesText(scenario),
    scenario.traps.map(t => `${t.title} ${t.detail}`).join(' '),
  ].join('\n')
}
