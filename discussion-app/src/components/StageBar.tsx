import { useEffect, useMemo, useState } from 'react'
import type { Stage } from '../types'
import { stageList, nextStageOf } from '../logic/stages'

const format = (seconds: number) => {
  const safe = Math.max(0, seconds)
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** 4단계 진행 바 + 단계별 타이머(기본 5/10/15/10분) */
export function StageBar({
  stage,
  paused,
  onSelect,
  onNext,
}: {
  stage: Stage
  paused: boolean
  onSelect?: (stage: Stage) => void
  onNext?: () => void
}) {
  const current = stageList.find(item => item.id === stage) ?? stageList[0]
  const [left, setLeft] = useState(current.minutes * 60)

  useEffect(() => {
    setLeft(current.minutes * 60)
  }, [current.id, current.minutes])

  useEffect(() => {
    if (paused || left <= 0) return
    const timer = window.setTimeout(() => setLeft(value => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left, paused])

  const timeUp = left <= 0
  const next = useMemo(() => nextStageOf(stage), [stage])

  return (
    <div className={timeUp ? 'stage-bar is-timeup' : 'stage-bar'}>
      <ol className="stage-steps" aria-label="토의 단계">
        {stageList.map(item => {
          const active = item.id === stage
          const done = item.number < current.number
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`stage-step${active ? ' is-on' : ''}${done ? ' is-done' : ''}`}
                onClick={() => onSelect?.(item.id)}
                aria-current={active ? 'step' : undefined}
                title={`${item.number}단계 · ${item.label} (${item.minutes}분)`}
              >
                <span className="stage-step-num">{item.number}</span>
                <span className="stage-step-label">{item.short}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="stage-meta">
        <span className={timeUp ? 'stage-timer is-timeup' : 'stage-timer'} aria-live="polite">
          {timeUp ? '시간 종료' : format(left)}
        </span>
        <span className="stage-name">
          {current.number}단계 · {current.label}
        </span>
        {next && onNext ? (
          <button
            type="button"
            className="stage-next"
            onClick={onNext}
            title="연습용으로 기다리지 않고 다음 단계로 이동합니다"
          >
            다음 단계로
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
