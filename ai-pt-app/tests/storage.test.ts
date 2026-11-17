import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendAttempt,
  clearAttempts,
  exportHistoryJson,
  loadAttempts,
  loadChat,
  loadDraft,
  loadNotes,
  loadSettings,
  loadTimer,
  parseHistoryJson,
  removeAttempt,
  saveAttempts,
  saveChat,
  saveDraft,
  saveNotes,
  saveSettings,
  saveTimer,
} from '../src/logic/storage'
import { demoGrade } from '../src/logic/grade'
import { BUILTIN_SCENARIOS } from '../src/data/scenarios'
import type { Attempt, ChatMessage } from '../src/types'

const scenario = BUILTIN_SCENARIOS[0]

function makeAttempt(id: string): Attempt {
  const grade = demoGrade(scenario, '결론적으로 C안입니다.', [])
  return {
    id,
    at: Date.now(),
    scenarioId: scenario.id,
    scenarioCode: scenario.code,
    scenarioTitle: scenario.title,
    field: scenario.field,
    score: grade.total,
    answerLength: 12,
    chatTurns: 0,
    durationSec: 600,
    grade,
    answer: '결론적으로 C안입니다.',
    chat: [],
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('답안·채팅·메모·타이머 저장', () => {
  it('초안을 저장하고 다시 읽는다', () => {
    saveDraft(scenario.id, '작성 중인 답안')
    expect(loadDraft(scenario.id)).toBe('작성 중인 답안')
    expect(loadDraft('없는-과제')).toBe('')
  })

  it('채팅 로그를 저장하고 잘못된 항목은 걸러 낸다', () => {
    const chat: ChatMessage[] = [
      { id: '1', role: 'user', text: '질문', at: 1 },
      { id: '2', role: 'ai', text: '답변', at: 2, demo: true },
    ]
    saveChat(scenario.id, chat)
    expect(loadChat(scenario.id)).toHaveLength(2)
    localStorage.setItem(`aipt_chat_${scenario.id}`, JSON.stringify([{ role: 'x', text: 1 }, chat[0]]))
    const loaded = loadChat(scenario.id)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].text).toBe('질문')
  })

  it('발표 메모를 저장한다', () => {
    saveNotes(scenario.id, '1문장 결론')
    expect(loadNotes(scenario.id)).toBe('1문장 결론')
  })

  it('타이머 상태를 저장한다', () => {
    saveTimer(scenario.id, { limit: 30, remaining: 1200, running: true, endAt: Date.now() + 1200000, startedAt: Date.now() })
    const timer = loadTimer(scenario.id)
    expect(timer?.limit).toBe(30)
    expect(timer?.running).toBe(true)
  })

  it('설정을 저장하고 읽는다(기본 코치 ON)', () => {
    expect(loadSettings().coachOn).toBe(true)
    saveSettings({ apiKey: 'AIzaTEST', model: 'gemini-2.5-flash-lite', coachOn: false })
    const loaded = loadSettings()
    expect(loaded.apiKey).toBe('AIzaTEST')
    expect(loaded.coachOn).toBe(false)
  })
})

describe('연습 기록', () => {
  it('기록을 추가하면 최신순으로 쌓인다', () => {
    appendAttempt(makeAttempt('a'))
    appendAttempt(makeAttempt('b'))
    const attempts = loadAttempts()
    expect(attempts).toHaveLength(2)
    expect(attempts[0].id).toBe('b')
  })

  it('기록을 삭제한다', () => {
    appendAttempt(makeAttempt('a'))
    const after = removeAttempt('a')
    expect(after).toHaveLength(0)
    expect(loadAttempts()).toHaveLength(0)
  })

  it('전체 삭제', () => {
    appendAttempt(makeAttempt('a'))
    clearAttempts()
    expect(loadAttempts()).toHaveLength(0)
  })

  it('JSON으로 내보내고 다시 불러온다(왕복)', () => {
    const attempt = makeAttempt('a')
    saveAttempts([attempt])
    const json = exportHistoryJson(loadAttempts())
    expect(json).toContain('"attempts"')
    const parsed = parseHistoryJson(json)
    expect(parsed.ok).toBe(true)
    expect(parsed.attempts).toHaveLength(1)
    expect(parsed.attempts[0].grade.total).toBe(attempt.grade.total)
  })

  it('배열 형태 JSON도 불러온다', () => {
    const json = JSON.stringify([makeAttempt('x')])
    const parsed = parseHistoryJson(json)
    expect(parsed.ok).toBe(true)
    expect(parsed.attempts[0].id).toBe('x')
  })

  it('깨진 JSON·빈 기록은 오류로 알린다', () => {
    expect(parseHistoryJson('not json').ok).toBe(false)
    expect(parseHistoryJson('{"attempts":[]}').ok).toBe(false)
  })
})
