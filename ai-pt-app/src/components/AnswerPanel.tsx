import { useState } from 'react'
import { ANSWER_SKELETON, NOTES_HINT } from '../data/skeleton'
import { ANSWER_LIMIT, countChars, formatClock } from '../logic/text'

type Props = {
  value: string
  onChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  remaining: number
  timed: boolean
  savedLabel: string
  onSubmit: () => void
  submitting: boolean
}

export function AnswerPanel({
  value,
  onChange,
  notes,
  onNotesChange,
  remaining,
  timed,
  savedLabel,
  onSubmit,
  submitting,
}: Props) {
  const [notesOpen, setNotesOpen] = useState(false)
  const count = countChars(value)
  const over = count > ANSWER_LIMIT
  const coachVisible = timed && remaining > 0 && remaining <= 300

  const insertSkeleton = () => {
    if (!value.trim()) {
      onChange(ANSWER_SKELETON)
      return
    }
    if (value.includes('[결론 요약]')) return
    onChange(`${value.replace(/\s+$/, '')}\n\n${ANSWER_SKELETON}`)
  }

  return (
    <section className="panel panel-answer" aria-label="답안 작성">
      <header className="panel-head">
        <h2>답안 작성</h2>
        <div className="head-tools">
          <button type="button" className="btn btn-ghost btn-sm" onClick={insertSkeleton}>
            뼈대 삽입
          </button>
          <span className="save-state">{savedLabel}</span>
        </div>
      </header>

      {coachVisible ? (
        <div className="time-banner" role="status">
          ⏰ 5분 남았습니다! 자료 숫자·단위 대조와 발표 첫 3문장을 정리하세요.
        </div>
      ) : null}

      <div className="answer-meta">
        <span className={`counter ${over ? 'is-over' : count > ANSWER_LIMIT * 0.9 ? 'is-warn' : ''}`}>
          {count.toLocaleString()} / {ANSWER_LIMIT.toLocaleString()}자
        </span>
        <span className="muted">
          남은 시간 {formatClock(remaining)} · 공백 포함 기준
        </span>
      </div>
      {over ? (
        <p className="over-warning">⚠ 3,000자를 {count - ANSWER_LIMIT}자 초과했습니다. 제출 전에 줄여 주세요.</p>
      ) : null}

      <textarea
        className="answer-editor"
        value={value}
        placeholder="의사결정 보고서를 작성하세요. 결론 → 근거 → 대가 → 실행계획 순서가 평가에 유리합니다."
        onChange={event => onChange(event.target.value)}
        spellCheck={false}
      />

      <div className="answer-foot">
        <button
          type="button"
          className="btn btn-ghost btn-sm notes-toggle"
          onClick={() => setNotesOpen(open => !open)}
          aria-expanded={notesOpen}
        >
          {notesOpen ? '▾' : '▸'} 발표용 3문장 메모
          <span className="muted">{countChars(notes) ? `(${countChars(notes)}자)` : '(본문·글자수 미포함)'}</span>
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={submitting || over}
          title={over ? '3,000자를 넘으면 제출할 수 없습니다' : 'AI 채점으로 이동'}
        >
          {submitting ? '채점 중…' : '최종 제출 및 AI 채점'}
        </button>
      </div>

      {notesOpen ? (
        <div className="notes-box">
          <label htmlFor="speech-notes">구두 발표 메모 (저장만 되고 제출 답안에는 포함되지 않습니다)</label>
          <textarea
            id="speech-notes"
            value={notes}
            placeholder={NOTES_HINT}
            onChange={event => onNotesChange(event.target.value)}
            rows={4}
          />
        </div>
      ) : null}
    </section>
  )
}
