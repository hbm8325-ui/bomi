import type { Difficulty, ModelAnswer, Resource, ResourceBlock, ResourceTable, Scenario, Trap } from '../types'
import { blockToText } from '../data/scenarios'

export const CUSTOM_STORAGE_KEY = 'pt_custom_scenarios_v1'

export type ScenarioInput = {
  title?: unknown
  code?: unknown
  field?: unknown
  difficulty?: unknown
  background?: unknown
  mission?: unknown
  constraints?: unknown
  resources?: unknown
  traps?: unknown
  mustAsk?: unknown
  modelAnswer?: unknown
  minutes?: unknown
}

type ParsedResource = {
  label?: unknown
  title?: unknown
  summary?: unknown
  meta?: unknown
  content?: unknown
  blocks?: unknown
}

type ParsedTrap = { title?: unknown; detail?: unknown; keywords?: unknown }

export type ParseOutcome = {
  ok: boolean
  scenarios: Scenario[]
  errors: string[]
  /** 항목별 경고(가져오긴 했지만 확인 권장) */
  warnings: string[]
}

const DEFAULT_CONSTRAINTS = [
  '답안 3,000자 이내(공백 포함)',
  '결론을 먼저 쓰고 근거·대가·실행계획 순으로 작성',
  '자료에 없는 값은 "자료 없음"으로 표시',
]

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/** 코드펜스·앞뒤 설명이 섞인 응답에서 JSON 본문만 꺼냅니다. */
export function stripToJson(raw: string): string {
  let text = raw.replace(/^\uFEFF/, '').trim()
  // ```json ... ``` (여러 개여도 첫 블록 우선)
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fence && fence[1].trim()) text = fence[1].trim()
  else text = text.replace(/```(?:json|JSON)?/g, '').replace(/```/g, '').trim()

  const objStart = text.indexOf('{')
  const arrStart = text.indexOf('[')
  const starts = [objStart, arrStart].filter(i => i >= 0)
  if (!starts.length) return text
  const start = Math.min(...starts)
  const objEnd = text.lastIndexOf('}')
  const arrEnd = text.lastIndexOf(']')
  const end = Math.max(objEnd, arrEnd)
  if (end > start) return text.slice(start, end + 1).trim()
  return text
}

/** 마크다운 표/불릿/문단을 앱 블록으로 변환합니다. */
export function parseContentBlocks(content: string): ResourceBlock[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ResourceBlock[] = []
  let paragraph: string[] = []
  let bullets: string[] = []
  let tableLines: string[] = []

  const flushParagraph = () => {
    const text = paragraph.join('\n').trim()
    if (text) blocks.push({ kind: 'text', text })
    paragraph = []
  }
  const flushBullets = () => {
    if (bullets.length) blocks.push({ kind: 'bullets', items: [...bullets] })
    bullets = []
  }
  const flushTable = () => {
    if (tableLines.length >= 2) {
      const table = markdownTable(tableLines)
      if (table) blocks.push({ kind: 'table', table })
    } else if (tableLines.length) {
      paragraph.push(...tableLines)
    }
    tableLines = []
  }
  const flushAll = () => {
    flushTable()
    flushBullets()
    flushParagraph()
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (/^\|.*\|/.test(trimmed)) {
      flushBullets()
      flushParagraph()
      tableLines.push(trimmed)
      continue
    }
    if (tableLines.length) flushTable()

    if (/^[-*•]\s+/.test(trimmed)) {
      flushParagraph()
      bullets.push(trimmed.replace(/^[-*•]\s+/, ''))
      continue
    }
    if (bullets.length && trimmed) {
      flushBullets()
    }
    if (!trimmed) {
      flushBullets()
      flushParagraph()
      continue
    }
    flushBullets()
    paragraph.push(trimmed)
  }
  flushAll()
  return blocks.length ? blocks : [{ kind: 'text', text: content.trim() }]
}

function markdownTable(lines: string[]): ResourceTable | null {
  const cells = (line: string) =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim())
  const head = cells(lines[0])
  if (head.length < 2) {
    return null
  }
  const body = lines.slice(1).filter(line => !/^\|?\s*:?-{2,}/.test(line))
  const rows = body.map(cells).filter(row => row.some(cell => cell.length > 0))
  if (!rows.length) return null
  return { head, rows }
}

function normalizeTable(value: unknown): ResourceTable | null {
  const source = value as { head?: unknown; rows?: unknown; caption?: unknown; note?: unknown } | null
  if (!source || !Array.isArray(source.head) || !Array.isArray(source.rows)) return null
  const head = source.head.map(asText).filter(Boolean)
  if (head.length < 2) return null
  const rows = (source.rows as unknown[])
    .filter(Array.isArray)
    .map(row => (row as unknown[]).map(asText))
    .filter(row => row.length > 0)
  if (!rows.length) return null
  return { head, rows, caption: asText(source.caption) || undefined, note: asText(source.note) || undefined }
}

function normalizeBlocks(value: unknown): ResourceBlock[] {
  if (!Array.isArray(value)) return []
  const blocks: ResourceBlock[] = []
  for (const item of value) {
    const block = item as { kind?: unknown; text?: unknown; items?: unknown; table?: unknown }
    if (!block || typeof block !== 'object') continue
    if (block.kind === 'text' && asText(block.text)) blocks.push({ kind: 'text', text: asText(block.text) })
    else if (block.kind === 'bullets' && Array.isArray(block.items)) {
      const items = block.items.map(asText).filter(Boolean)
      if (items.length) blocks.push({ kind: 'bullets', items })
    } else if (block.kind === 'table') {
      const table = normalizeTable(block.table)
      if (table) blocks.push({ kind: 'table', table })
    }
  }
  return blocks
}

function normalizeResource(value: unknown, index: number, errors: string[]): Resource | null {
  const item = value as ParsedResource | null
  if (!item || typeof item !== 'object') {
    errors.push(`자료 ${index + 1}: 객체 형식이 아닙니다.`)
    return null
  }
  const title = asText(item.title)
  const content = asText(item.content)
  let blocks = normalizeBlocks(item.blocks)
  if (!blocks.length && content) blocks = parseContentBlocks(content)
  if (!blocks.length) {
    errors.push(`자료 ${index + 1}: title과 content(또는 blocks)가 필요합니다.`)
    return null
  }
  return {
    id: `r${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    label: asText(item.label) || `자료 ${index + 1}`,
    title: title || `자료 ${index + 1}`,
    summary: asText(item.summary) || blocks.find(b => b.kind === 'text')?.text.slice(0, 90) || '',
    meta: asText(item.meta) || undefined,
    blocks,
  }
}

function normalizeTrap(value: unknown, index: number, errors: string[]): Trap | null {
  const item = value as ParsedTrap | null
  if (!item || typeof item !== 'object') {
    errors.push(`함정 ${index + 1}: 객체 형식이 아닙니다.`)
    return null
  }
  const title = asText(item.title)
  const detail = asText(item.detail)
  if (!title || !detail) {
    errors.push(`함정 ${index + 1}: title과 detail이 모두 필요합니다.`)
    return null
  }
  const keywords = Array.isArray(item.keywords)
    ? (item.keywords as unknown[]).map(asText).filter(Boolean).slice(0, 8)
    : detail
        .split(/[,\s·]+/)
        .filter(word => word.length >= 2)
        .slice(0, 4)
  return { id: `t${index + 1}-${Math.random().toString(36).slice(2, 6)}`, title, detail, keywords }
}

export function makeId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return `custom-${slug || 'scenario'}-${Math.random().toString(36).slice(2, 6)}`
}

const DIFFICULTY_VALUES: Difficulty[] = ['입문', '보통', '심화']

/** difficulty가 없거나 이상하면 '보통'으로 두고, modelAnswer는 report가 있을 때만 살립니다. */
function normalizeDifficulty(value: unknown): Difficulty | undefined {
  const text = asText(value)
  return (DIFFICULTY_VALUES as string[]).includes(text) ? (text as Difficulty) : undefined
}

function normalizeModelAnswer(value: unknown): ModelAnswer | undefined {
  if (!value || typeof value !== 'object') return undefined
  const item = value as { report?: unknown; points?: unknown; samplePrompts?: unknown }
  const report = asText(item.report)
  if (!report) return undefined
  const points = Array.isArray(item.points) ? (item.points as unknown[]).map(asText).filter(Boolean).slice(0, 6) : []
  const samplePrompts = Array.isArray(item.samplePrompts)
    ? (item.samplePrompts as unknown[]).map(asText).filter(Boolean).slice(0, 6)
    : []
  return { report, points, samplePrompts }
}

export function normalizeScenarioInput(raw: unknown, errors: string[], warnings: string[], now = Date.now()): Scenario | null {
  const item = raw as ScenarioInput | null
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    errors.push('과제 항목이 객체가 아닙니다.')
    return null
  }
  const title = asText(item.title)
  const background = asText(item.background)
  const mission = asText(item.mission)
  if (!title) errors.push('title(과제 제목)이 없습니다.')
  if (!background) errors.push('background(과제 배경)가 없습니다.')
  if (!mission) errors.push('mission(미션)이 없습니다.')

  const resourcesRaw = Array.isArray(item.resources) ? (item.resources as unknown[]) : []
  if (resourcesRaw.length < 2) {
    if (resourcesRaw.length === 1) warnings.push(`"${title || '새 과제'}": 참고자료가 1개뿐입니다. 2개를 권장합니다.`)
    else errors.push('resources(참고자료)가 2개 필요합니다.')
  }
  const resources = resourcesRaw
    .map((resource, index) => normalizeResource(resource, index, errors))
    .filter((resource): resource is Resource => Boolean(resource))

  const trapsRaw = Array.isArray(item.traps) ? (item.traps as unknown[]) : []
  const traps = trapsRaw
    .map((trap, index) => normalizeTrap(trap, index, errors))
    .filter((trap): trap is Trap => Boolean(trap))
  if (!traps.length) warnings.push(`"${title || '새 과제'}": 숨은 함정이 없어 채점 리포트의 함정 탐지가 비어 있습니다.`)

  const constraints = Array.isArray(item.constraints)
    ? (item.constraints as unknown[]).map(asText).filter(Boolean).slice(0, 6)
    : []
  const mustAsk = Array.isArray(item.mustAsk) ? (item.mustAsk as unknown[]).map(asText).filter(Boolean).slice(0, 6) : []

  const difficulty = normalizeDifficulty(item.difficulty)
  if (item.difficulty !== undefined && item.difficulty !== null && asText(item.difficulty) && !difficulty) {
    warnings.push(`"${title || '새 과제'}": difficulty는 입문·보통·심화 중 하나여야 합니다. 값이 무시됐습니다.`)
  }
  const modelAnswer = normalizeModelAnswer(item.modelAnswer)

  if (errors.length) return null

  return {
    id: makeId(title),
    code: asText(item.code) || '사용자 과제',
    title: title.slice(0, 140),
    field: asText(item.field) || '사용자 추가',
    difficulty,
    background,
    mission,
    constraints: constraints.length ? constraints : [...DEFAULT_CONSTRAINTS],
    resources,
    traps,
    mustAsk: mustAsk.length ? mustAsk : undefined,
    modelAnswer,
    source: 'custom',
    createdAt: now,
  }
}

/** 단일 객체·배열·{scenarios:[...]} 모두 허용합니다. */
export function parseScenarioJson(raw: string): ParseOutcome {
  const errors: string[] = []
  const warnings: string[] = []
  const text = stripToJson(raw)
  if (!text) return { ok: false, scenarios: [], errors: ['붙여 넣은 내용이 비어 있습니다.'], warnings }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      scenarios: [],
      errors: [`JSON 형식이 올바르지 않습니다: ${(error as Error).message}`],
      warnings,
    }
  }

  let items: unknown[] = []
  if (Array.isArray(data)) items = data
  else if (data && typeof data === 'object') {
    const boxed = (data as { scenarios?: unknown }).scenarios
    if (Array.isArray(boxed)) items = boxed
    else items = [data]
  }

  if (!items.length) return { ok: false, scenarios: [], errors: ['과제 데이터를 찾지 못했습니다.'], warnings }

  const scenarios: Scenario[] = []
  items.forEach((item, index) => {
    const itemErrors: string[] = []
    const scenario = normalizeScenarioInput(item, itemErrors, warnings)
    if (scenario) scenarios.push(scenario)
    else errors.push(...itemErrors.map(message => `[${index + 1}번째 과제] ${message}`))
  })

  return { ok: scenarios.length > 0, scenarios, errors, warnings }
}

/** 저장된 과제를 다시 '입력 JSON' 형태로 내보냅니다(재가져오기 가능). */
export function scenarioToInput(scenario: Scenario) {
  return {
    title: scenario.title,
    field: scenario.field,
    difficulty: scenario.difficulty,
    background: scenario.background,
    mission: scenario.mission,
    constraints: scenario.constraints,
    resources: scenario.resources.map(resource => ({
      label: resource.label,
      title: resource.title,
      summary: resource.summary,
      content: resource.blocks.map(block => blockToText(block)).join('\n\n'),
    })),
    traps: scenario.traps.map(trap => ({ title: trap.title, detail: trap.detail, keywords: trap.keywords })),
    mustAsk: scenario.mustAsk,
    modelAnswer: scenario.modelAnswer,
  }
}

export function exportCustomJson(scenarios: Scenario[]): string {
  return JSON.stringify(scenarios.map(scenarioToInput), null, 2)
}

/** ------------------------------ localStorage ------------------------------ */

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function loadCustomScenarios(): Scenario[] {
  const store = storage()
  if (!store) return []
  try {
    const raw = store.getItem(CUSTOM_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    const list = Array.isArray(parsed)
      ? parsed
      : ((parsed as { scenarios?: unknown })?.scenarios as unknown[]) ?? []
    return list
      .map((item): Scenario | null => {
        const scenario = item as Scenario
        if (!scenario || typeof scenario !== 'object' || !scenario.title) return null
        return {
          ...scenario,
          source: 'custom',
          constraints: Array.isArray(scenario.constraints) ? scenario.constraints : [...DEFAULT_CONSTRAINTS],
          resources: Array.isArray(scenario.resources) ? scenario.resources : [],
          traps: Array.isArray(scenario.traps) ? scenario.traps : [],
        }
      })
      .filter((scenario): scenario is Scenario => scenario !== null)
  } catch {
    return []
  }
}

export function saveCustomScenarios(scenarios: Scenario[]): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(
      CUSTOM_STORAGE_KEY,
      JSON.stringify({ version: 1, updatedAt: Date.now(), scenarios }),
    )
    return true
  } catch {
    return false
  }
}

export function upsertCustomScenario(scenario: Scenario): Scenario[] {
  const list = loadCustomScenarios()
  const index = list.findIndex(item => item.id === scenario.id)
  const next = index >= 0 ? list.map(item => (item.id === scenario.id ? scenario : item)) : [scenario, ...list]
  saveCustomScenarios(next)
  return next
}

export function deleteCustomScenario(id: string): Scenario[] {
  const next = loadCustomScenarios().filter(item => item.id !== id)
  saveCustomScenarios(next)
  return next
}

export function clearCustomScenarios(): void {
  const store = storage()
  try {
    store?.removeItem(CUSTOM_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
