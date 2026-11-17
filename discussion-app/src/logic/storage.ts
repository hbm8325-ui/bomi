import { KEY_STORAGE } from './gemini'
import type { DebateMode, DisplayMode, Pace, SavedSession, Settings } from '../types'

const SETTINGS_KEY = 'hd_settings_v1'
const HISTORY_KEY = 'hd_history_v1'

export const defaultSettings: Settings = {
  displayMode: 'normal',
  debateMode: 'basic',
  pace: 'normal',
  model: null,
  voice: true,
  discussionStyle: 'consensus',
  tts: false,
}

const hasWindow = () => typeof window !== 'undefined' && !!window.localStorage

export function loadSettings(): Settings {
  if (!hasWindow()) return { ...defaultSettings }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      displayMode: parsed.displayMode === 'real' ? 'real' : 'normal',
      debateMode: parsed.debateMode === 'deep' ? 'deep' : 'basic',
      pace: parsed.pace === 'relaxed' || parsed.pace === 'fast' ? parsed.pace : 'normal',
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : null,
      voice: parsed.voice !== false,
      discussionStyle: parsed.discussionStyle === 'debate' ? 'debate' : 'consensus',
      tts: parsed.tts === true,
    }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(settings: Settings): void {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* 저장 공간이 가득 차도 앱 동작은 유지합니다. */
  }
}

export function loadApiKey(): string {
  if (!hasWindow()) return ''
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function saveApiKey(key: string): void {
  if (!hasWindow()) return
  if (!key.trim()) {
    window.localStorage.removeItem(KEY_STORAGE)
    return
  }
  window.localStorage.setItem(KEY_STORAGE, key.trim())
}

export function clearApiKey(): void {
  if (!hasWindow()) return
  window.localStorage.removeItem(KEY_STORAGE)
}

const isMessage = (value: unknown): boolean =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as { text?: unknown }).text === 'string' &&
  typeof (value as { speakerId?: unknown }).speakerId === 'string'

export function loadSessions(): SavedSession[] {
  if (!hasWindow()) return []
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is SavedSession =>
          !!item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.topicTitle === 'string' &&
          Array.isArray(item.messages) &&
          item.messages.every(isMessage),
      )
      .sort((a, b) => b.startedAt - a.startedAt)
  } catch {
    return []
  }
}

export function saveSessions(sessions: readonly SavedSession[]): void {
  if (!hasWindow()) return
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions))
  } catch {
    /* 용량 초과 시 조용히 무시합니다. */
  }
}

export function upsertSession(sessions: readonly SavedSession[], session: SavedSession): SavedSession[] {
  const next = [session, ...sessions.filter(item => item.id !== session.id)].sort(
    (a, b) => b.startedAt - a.startedAt,
  )
  saveSessions(next)
  return next
}

export function removeSession(sessions: readonly SavedSession[], id: string): SavedSession[] {
  const next = sessions.filter(item => item.id !== id)
  saveSessions(next)
  return next
}

export function mergeSessions(
  current: readonly SavedSession[],
  incoming: readonly SavedSession[],
): { sessions: SavedSession[]; added: number; updated: number } {
  const map = new Map(current.map(item => [item.id, item]))
  let added = 0
  let updated = 0
  for (const item of incoming) {
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
      added += 1
    } else if ((item.feedback?.createdAt ?? 0) >= (existing.feedback?.createdAt ?? 0)) {
      map.set(item.id, { ...existing, ...item })
      updated += 1
    }
  }
  const sessions = [...map.values()].sort((a, b) => b.startedAt - a.startedAt)
  saveSessions(sessions)
  return { sessions, added, updated }
}

export function makeSessionId(): string {
  const random = Math.random().toString(36).slice(2, 8)
  return `hd_${Date.now().toString(36)}_${random}`
}

export function exportSessions(sessions: readonly SavedSession[]): void {
  const payload = {
    app: 'humanities-debate-web',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `humanities-debate-backup-${date}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function parseImportedSessions(text: string): SavedSession[] {
  const data = JSON.parse(text) as { sessions?: unknown } | unknown[]
  const list = Array.isArray(data) ? data : Array.isArray((data as { sessions?: unknown }).sessions) ? (data as { sessions: unknown[] }).sessions : null
  if (!list) throw new Error('백업 파일 형식이 아닙니다.')
  const sessions = list.filter(
    (item): item is SavedSession =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as SavedSession).id === 'string' &&
      typeof (item as SavedSession).topicTitle === 'string' &&
      Array.isArray((item as SavedSession).messages),
  )
  if (!sessions.length) throw new Error('가져올 토의 기록이 없습니다.')
  return sessions
}

export const modeLabel = (mode: DebateMode) => (mode === 'deep' ? '팀원 2명 응답' : '팀원 1명 응답')
export const displayLabel = (mode: DisplayMode) => (mode === 'real' ? '실전 모드' : '일반 모드')
export const paceLabel = (pace: Pace) =>
  pace === 'relaxed' ? '여유' : pace === 'fast' ? '빠름' : '보통'
