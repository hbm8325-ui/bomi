import { useState } from 'react'
import type { Attempt } from '../types'
import { formatDateTime } from '../logic/text'
import { Sheet } from './Sheet'

type Props = {
  attempts: Attempt[]
  onClose: () => void
  onOpen: (attempt: Attempt) => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: (raw: string) => { ok: boolean; message: string }
}

const gradeColor = (score: number) => (score >= 80 ? 'is-good' : score >= 60 ? 'is-mid' : 'is-low')

export function HistorySheet({ attempts, onClose, onOpen, onDelete, onExport, onImport }: Props) {
  const [importMessage, setImportMessage] = useState('')

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const result = onImport(text)
    setImportMessage(result.message)
    event.target.value = ''
  }

  return (
    <Sheet
      title="지난 연습 기록"
      subtitle="이 PC에만 저장됩니다. JSON으로 내보내 다른 PC나 다른 브라우저로 옮길 수 있습니다."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <input
            type="file"
            accept=".json,application/json"
            onChange={onFile}
            className="file-input"
            aria-label="기록 JSON 불러오기"
          />
          <button type="button" className="btn btn-ghost" onClick={onExport} disabled={!attempts.length}>
            ⬇ JSON 내보내기
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            닫기
          </button>
        </>
      }
    >
      {importMessage ? <p className="status-line is-ok">{importMessage}</p> : null}
      {attempts.length === 0 ? (
        <p className="empty-note">아직 기록이 없습니다. 답안을 제출하면 점수·함정 리포트·꼬리질문이 자동 저장됩니다.</p>
      ) : (
        <ul className="history-list">
          {attempts.map(attempt => (
            <li key={attempt.id} className="history-row">
              <button type="button" className="history-main" onClick={() => onOpen(attempt)}>
                <span className={`score-chip ${gradeColor(attempt.score)}`}>{Math.round(attempt.score)}점</span>
                <span className="history-text">
                  <strong>
                    {attempt.scenarioCode} {attempt.scenarioTitle}
                  </strong>
                  <span className="muted">
                    {formatDateTime(attempt.at)} · 답안 {attempt.answerLength.toLocaleString()}자 · AI 질문 {attempt.chatTurns}회
                    {attempt.autoSubmitted ? ' · 시간종료 자동제출' : ''}
                  </span>
                </span>
                <span className="history-open">리포트 ›</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs is-danger"
                onClick={() => onDelete(attempt.id)}
                aria-label="기록 삭제"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
