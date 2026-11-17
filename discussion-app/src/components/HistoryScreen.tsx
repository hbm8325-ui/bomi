import { useRef } from 'react'
import type { SavedSession } from '../types'
import { nameOf } from '../data/participants'
import { modeLabel } from '../logic/storage'
import { userUtteranceIds } from '../logic/prompts'

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function HistoryScreen({
  sessions,
  selected,
  onOpen,
  onBack,
  onDelete,
  onExport,
  onImportFile,
  onHome,
}: {
  sessions: SavedSession[]
  selected: SavedSession | null
  onOpen: (session: SavedSession) => void
  onBack: () => void
  onDelete: (id: string) => void
  onExport: () => void
  onImportFile: (file: File) => void
  onHome: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  if (selected) {
    const ids = userUtteranceIds(selected.messages)
    return (
      <div className="screen history-screen">
        <header className="feedback-head">
          <button className="icon-button" onClick={onBack} aria-label="목록으로">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M14.5 5L7.5 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="feedback-head-copy">
            <span className="debate-cat">{formatDate(selected.startedAt)} · {modeLabel(selected.mode)}</span>
            <h1>{selected.topicTitle}</h1>
          </div>
        </header>
        <div className="feedback-scroll">
          {selected.feedback ? (
            <>
              <section className="card score-card">
                <div className="score-top">
                  <div className="history-total">
                    <strong>{selected.feedback.total ?? '–'}</strong>
                    <span>/ 100</span>
                  </div>
                  <p className="score-summary">{selected.feedback.summary}</p>
                </div>
              </section>
              <section className="criteria">
                {selected.feedback.criteria.map(criterion => (
                  <article key={criterion.key} className="criterion card">
                    <div className="criterion-head">
                      <span className="criterion-name">{criterion.label}</span>
                      <span className={criterion.observed ? 'criterion-score' : 'criterion-score is-hold'}>
                        {criterion.observed && criterion.score !== null ? criterion.score : '보류'}
                      </span>
                    </div>
                    <div className="bar" aria-hidden="true">
                      <span style={{ width: `${criterion.observed && criterion.score !== null ? criterion.score : 0}%` }} />
                    </div>
                    <p className="criterion-reason">{criterion.reason}</p>
                    {criterion.citations.length ? (
                      <div className="cite-row">
                        {criterion.citations.map(cite => (
                          <span key={cite} className="cite-chip">
                            {cite}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </section>
            </>
          ) : (
            <p className="card empty-note">이 토의에는 저장된 피드백이 없습니다.</p>
          )}

          {selected.jointDeliverable || selected.feedback?.followUps?.length ? (
            <section className="card deliverable-card">
              <div className="card-head">
                <h2>공동 결과물 · 꼬리질문</h2>
              </div>
              {selected.jointDeliverable ? <pre className="deliverable-text">{selected.jointDeliverable}</pre> : null}
              {selected.feedback?.followUps?.length ? (
                <ol className="followup-history">
                  {selected.feedback.followUps.map((followUp, index) => (
                    <li key={index}>
                      <strong>Q{index + 1}</strong> {followUp.question}
                      {followUp.defense ? <p className="fine-print">내 답변: {followUp.defense}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          ) : null}

          <section className="card transcript-card is-open">
            <h2 className="section-title">토의 기록</h2>
            <ol className="transcript-list">
              {selected.messages.map(message => (
                <li key={message.id} className={message.speakerId === 'user' ? 'is-user' : ''}>
                  <span className="transcript-name">
                    {message.speakerId === 'user'
                      ? `나${ids.has(message.id) ? ` · ${ids.get(message.id)}` : ''}`
                      : nameOf(message.speakerId)}
                  </span>
                  <p>{message.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <div className="feedback-actions">
            <button className="soft-button danger" onClick={() => onDelete(selected.id)}>
              이 기록 삭제
            </button>
            <button className="ghost-button" onClick={onHome}>
              홈으로
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen history-screen">
      <header className="feedback-head">
        <button className="icon-button" onClick={onHome} aria-label="홈으로">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M14.5 5L7.5 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="feedback-head-copy">
          <span className="debate-cat">과거 기록</span>
          <h1>지난 토의 {sessions.length}개</h1>
        </div>
      </header>

      <div className="feedback-scroll">
        {sessions.length ? (
          <ul className="history-list">
            {sessions.map(session => (
              <li key={session.id}>
                <button className="history-row card" onClick={() => onOpen(session)}>
                  <div className="history-row-top">
                    <span className="chip chip-soft">{session.category}</span>
                    <span className="history-date">{formatDate(session.startedAt)}</span>
                  </div>
                  <p className="history-title">{session.topicTitle}</p>
                  <div className="history-row-bottom">
                    <span className="history-meta">
                      {modeLabel(session.mode)} · 발언 {session.messages.length}개
                      {session.jointDeliverable ? ' · 결과물' : ''}
                    </span>
                    <span className={session.feedback?.total != null ? 'history-score' : 'history-score is-empty'}>
                      {session.feedback?.total != null ? `${session.feedback.total}점` : '피드백 없음'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card empty-note">
            <p>아직 저장된 토의가 없습니다.</p>
            <p className="fine-print">토의를 끝내면 기록·공동 결과물·피드백이 자동으로 이 브라우저에 저장됩니다.</p>
          </div>
        )}

        <div className="feedback-actions">
          <button className="soft-button" onClick={onExport} disabled={!sessions.length}>
            JSON 내보내기
          </button>
          <button className="soft-button" onClick={() => fileRef.current?.click()}>
            JSON 가져오기
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) onImportFile(file)
            event.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
