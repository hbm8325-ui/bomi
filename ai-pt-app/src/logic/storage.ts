import type { Attempt, ChatMessage, Settings, TimerState } from '../types'

export const SETTINGS_KEY = 'aipt_settings_v1'
export const HISTORY_KEY = 'aipt_history_v1'

const draftKey = (id: string) => `aipt_draft_${id}`
const chatKey = (id: string) => `aipt_chat_${id}`
const timerKey = (id: string) => `aipt_timer_${id}`
const notesKey = (id: string) => `aipt_notes_${id}`

function store(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const s = store()
  if (!s) return fallback
  try {
    const raw = s.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  const s = store()
  if (!s) return
  try {
    s.setItem(key, JSON.stringify(value))
  } catch {
    /* quota */
  }
}

export function removeKey(key: string): void {
  try {
    store()?.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const DEFAULT_SETTINGS: Settings = { apiKey: '', model: null, coachOn: true }

export function loadSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_KEY, {})
  return {
    apiKey: typeof saved.apiKey === 'string' ? saved.apiKey : '',
    model: typeof saved.model === 'string' ? saved.model : null,
    coachOn: saved.coachOn !== false,
  }
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings)
}

export function loadDraft(scenarioId: string): string {
  return readJson<string>(draftKey(scenarioId), '')
}

export function saveDraft(scenarioId: string, text: string): void {
  writeJson(draftKey(scenarioId), text)
}

export function loadNotes(scenarioId: string): string {
  return readJson<string>(notesKey(scenarioId), '')
}

export function saveNotes(scenarioId: string, text: string): void {
  writeJson(notesKey(scenarioId), text)
}

export function loadChat(scenarioId: string): ChatMessage[] {
  const list = readJson<ChatMessage[]>(chatKey(scenarioId), [])
  if (!Array.isArray(list)) return []
  return list.filter(
    message =>
      message &&
      typeof message.text === 'string' &&
      (message.role === 'user' || message.role === 'ai'),
  )
}

export function saveChat(scenarioId: string, chat: ChatMessage[]): void {
  writeJson(chatKey(scenarioId), chat.slice(-80))
}

export function clearChat(scenarioId: string): void {
  removeKey(chatKey(scenarioId))
}

export function loadTimer(scenarioId: string): TimerState | null {
  const saved = readJson<TimerState | null>(timerKey(scenarioId), null)
  if (!saved || typeof saved.remaining !== 'number') return null
  return saved
}

export function saveTimer(scenarioId: string, timer: TimerState): void {
  writeJson(timerKey(scenarioId), timer)
}

export function clearTimer(scenarioId: string): void {
  removeKey(timerKey(scenarioId))
}

export function loadAttempts(): Attempt[] {
  const list = readJson<Attempt[]>(HISTORY_KEY, [])
  if (!Array.isArray(list)) return []
  return list.filter(item => item && typeof item.at === 'number' && item.grade)
}

export function saveAttempts(attempts: Attempt[]): void {
  writeJson(HISTORY_KEY, attempts.slice(0, 60))
}

export function appendAttempt(attempt: Attempt): Attempt[] {
  const next = [attempt, ...loadAttempts()].slice(0, 60)
  saveAttempts(next)
  return next
}

export function removeAttempt(id: string): Attempt[] {
  const next = loadAttempts().filter(item => item.id !== id)
  saveAttempts(next)
  return next
}

export function clearAttempts(): void {
  removeKey(HISTORY_KEY)
}

export function exportHistoryJson(attempts: Attempt[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), attempts }, null, 2)
}

export function parseHistoryJson(raw: string): { ok: boolean; attempts: Attempt[]; error?: string } {
  try {
    const text = raw.replace(/^\uFEFF/, '').trim()
    const data = JSON.parse(text) as unknown
    const list = Array.isArray(data) ? data : ((data as { attempts?: unknown })?.attempts as unknown[])
    if (!Array.isArray(list)) return { ok: false, attempts: [], error: '기록 배열을 찾지 못했습니다.' }
    const attempts = list.filter(
      (item): item is Attempt =>
        Boolean(item) && typeof (item as Attempt).at === 'number' && Boolean((item as Attempt).grade),
    )
    if (!attempts.length) return { ok: false, attempts: [], error: '불러올 수 있는 기록이 없습니다.' }
    return { ok: true, attempts }
  } catch (error) {
    return { ok: false, attempts: [], error: (error as Error).message }
  }
}
