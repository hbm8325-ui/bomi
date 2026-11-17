import { useState } from 'react'
import type { FollowUp } from '../types'

/** 면접관 꼬리질문 카드 + 1:1 방어 답변 리허설 */
export function FollowUpCard({
  index,
  followUp,
  onRehearsal,
  demo,
}: {
  index: number
  followUp: FollowUp
  onRehearsal: (followUp: FollowUp, defense: string) => Promise<string[]>
  demo: boolean
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(followUp.defense ?? '')
  const [lines, setLines] = useState<string[]>(followUp.coaching ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      setLines(await onRehearsal(followUp, text))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <li className="followup-card">
      <div className="followup-head">
        <span className="followup-num">Q{index + 1}</span>
        <p className="followup-q">{followUp.question}</p>
      </div>
      <p className="followup-intent">의도 · {followUp.intent}</p>
      {followUp.quote ? <p className="followup-quote">“{followUp.quote}”</p> : null}
      {followUp.points.length ? (
        <ul className="followup-points">
          {followUp.points.map((point, pointIndex) => (
            <li key={pointIndex}>{point}</li>
          ))}
        </ul>
      ) : null}

      {!open ? (
        <button type="button" className="soft-button small" onClick={() => setOpen(true)}>
          🎤 내 방어 답변 써보고 코칭 받기
        </button>
      ) : (
        <div className="rehearsal-box">
          <textarea
            className="text-input text-area"
            rows={3}
            value={text}
            maxLength={800}
            placeholder="면접관에게 말하듯 3~4문장으로 답해 보세요."
            onChange={event => setText(event.target.value)}
          />
          <div className="rehearsal-actions">
            <span className="fine-print">{text.trim().length}자</span>
            <button type="button" className="primary-button small" onClick={submit} disabled={loading || !text.trim()}>
              {loading ? '코칭 작성 중…' : '3줄 코칭 받기'}
            </button>
          </div>
          {error ? <p className="inline-warn">{error}</p> : null}
          {lines.filter(Boolean).length ? (
            <ul className="rehearsal-feedback">
              {lines.filter(Boolean).map((line, lineIndex) => (
                <li key={lineIndex}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="fine-print">
            {demo ? '데모 모드에서는 예시 코칭이 나옵니다. API 키를 연결하면 답변 내용을 실제로 읽고 코칭합니다.' : '코칭은 연습용입니다.'}
          </p>
        </div>
      )}
    </li>
  )
}
