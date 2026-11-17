/** 글자 수(공백 포함) — 이모지 등 서로게이트 쌍은 1자로 셉니다. */
export function countChars(text: string): number {
  return Array.from(text).length
}

export const ANSWER_LIMIT = 3000
export const CHAT_INPUT_LIMIT = 4000

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 긴 텍스트를 문장 경계에서 자릅니다(프롬프트 길이 관리용). */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'), slice.lastIndexOf('다. '))
  return `${(cut > max * 0.6 ? slice.slice(0, cut + 1) : slice).trim()}\n…(이하 생략)`
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 숫자 표기 흔들림(12.0 / 12 / 12,0)을 비교하기 위한 정규화 */
export function normalizeNumber(token: string): string {
  return token.replace(/,/g, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}
