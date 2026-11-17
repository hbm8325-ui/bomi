import type { Scenario } from '../types'
import { formatClock } from '../logic/text'

type Props = {
  scenario: Scenario
  remaining: number
  running: boolean
  limit: number
  onToggleTimer: () => void
  onResetTimer: () => void
  onChangeLimit: (minutes: number) => void
  onOpenPicker: () => void
  onOpenSettings: () => void
  onOpenHistory: () => void
  onSubmit: () => void
  apiReady: boolean
  submitting: boolean
}

export function Header({
  scenario,
  remaining,
  running,
  limit,
  onToggleTimer,
  onResetTimer,
  onChangeLimit,
  onOpenPicker,
  onOpenSettings,
  onOpenHistory,
  onSubmit,
  apiReady,
  submitting,
}: Props) {
  const urgent = remaining <= 300 && remaining > 0
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          AI
        </span>
        <div>
          <h1>SK하이닉스 문제해결 PT 연습실</h1>
          <p className="brand-sub">보건 직무 · Half-Day 실전 시뮬레이터</p>
        </div>
      </div>

      <button type="button" className="scenario-pick" onClick={onOpenPicker}>
        <span className="badge badge-code">{scenario.code}</span>
        <span className="scenario-pick-title">{scenario.title}</span>
        <span className="scenario-pick-arrow">▾</span>
      </button>

      <div className="header-right">
        <div className={`timer ${urgent ? 'is-urgent' : ''} ${running ? 'is-running' : ''}`}>
          <span className="timer-label">제한시간</span>
          <strong className="timer-value">{formatClock(remaining)}</strong>
          <select
            className="timer-select"
            value={limit}
            onChange={event => onChangeLimit(Number(event.target.value))}
            aria-label="제한시간 선택"
          >
            <option value={35}>35:00</option>
            <option value={30}>30:00</option>
          </select>
        </div>
        <div className="header-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onToggleTimer}>
            {running ? '⏸ 일시정지' : remaining === limit * 60 ? '▶ 시작' : '▶ 재개'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onResetTimer}>
            ⟲ 초기화
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
            ⚙ 설정 {apiReady ? <span className="dot dot-on" /> : <span className="dot" />}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenHistory}>
            🗂 지난 기록
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit} disabled={submitting}>
            {submitting ? '채점 중…' : '제출 및 AI 채점'}
          </button>
        </div>
      </div>
    </header>
  )
}
