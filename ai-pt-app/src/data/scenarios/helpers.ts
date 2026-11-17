import type { ResourceBlock, ResourceTable } from '../../types'

export const text = (t: string): ResourceBlock => ({ kind: 'text', text: t })
export const bullets = (items: string[]): ResourceBlock => ({ kind: 'bullets', items })
export const table = (head: string[], rows: string[][], caption?: string, note?: string): ResourceBlock => ({
  kind: 'table',
  table: { head, rows, caption, note } as ResourceTable,
})
