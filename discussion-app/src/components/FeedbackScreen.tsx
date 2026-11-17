import type { DebateTopic, Feedback, FollowUp, Message, PrepNotes } from '../types'
import { nameOf } from '../data/participants'
import { userUtteranceIds } from '../logic/prompts'
import { criterionAxis } from '../data/rubric'
import { ScoreRing } from './ScoreRing'
import { FollowUpCard } from './FollowUpCard'

export function FeedbackScreen({
  topic,
  messages,
  feedback,
  loading,
  error,
  prepNotes,
  jointDeliverable,
  onRetry,
  onRestart,
  onNewTopic,
  onOpenHistory,
  onOpenSettings,
  onOpenGuide,
  onRehearsal,
}: {
  topic: DebateTopic
  messages: Message[]
  feedback: Feedback | null
  loading: boolean
  error: string | null
  prepNotes?: PrepNotes
  jointDeliverable?: string
  onRetry: () => void
  onRestart: () => void
  onNewTopic: () => void
  onOpenHistory: () => void
  onOpenSettings: () => void
  onOpenGuide: () => void
  onRehearsal: (followUp: FollowUp, defense: string) => Promise<string[]>
}) {
  const userCount = messages.filter(m => m.speakerId === 'user').length
  const utteranceIds = userUtteranceIds(messages)
  const hasPrep = !!prepNotes && Object.values(prepNotes).some(value => value.trim())
  const deliverable = (jointDeliverable ?? '').trim()
  const followUps = feedback?.followUps ?? []

  return (
    <div className="screen feedback-screen">
      <header className="feedback-head">
        <button className="icon-button" onClick={onNewTopic} aria-label="홈으로">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M14.5 5L7.5 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="feedback-head-copy">
          <span className="debate-cat">그룹 토의 피드백</span>
          <h1>{topic.title}</h1>
        </div>
        <button className="icon-button" onClick={onOpenGuide} aria-label="모범 토의 보기" title="📖 모범 토의 & 결과물">
          📖
        </button>
      </header>

      <div className="feedback-scroll">
        {loading ? (
          <div className="card loading-card">
            <span className="spinner" aria-hidden="true" />
            <strong>토의 기록과 결과물을 읽고 있어요</strong>
            <p>기준·조율·경청·기여·표현 다섯 항목과 공동 결과물을 실제 발언 근거로 평가합니다. 10~30초 걸립니다.</p>
          </div>
        ) : null}

        {error && !loading ? (
          <div className="card error-card">
            <strong>피드백을 만들지 못했어요</strong>
            <p>{error}</p>
            <div className="error-actions">
              <button className="soft-button" onClick={onRetry}>
                다시 시도
              </button>
              <button className="soft-button" onClick={onOpenSettings}>
                설정 열기
              </button>
            </div>
          </div>
        ) : null}

        {feedback && !loading ? (
          <>
            <section className="score-card card">
              <div className="score-top">
                <ScoreRing total={feedback.total} />
                <div className="score-copy">
                  <span className="eyebrow">
                    {feedback.demo ? '데모 피드백' : '연습 피드백'} · 내 발언 {userCount}개
                    {deliverable ? ' · 결과물 제출' : ' · 결과물 없음'}
                  </span>
                  <p className="score-summary">{feedback.summary}</p>
                </div>
              </div>
              <p className="fine-print">
                {feedback.demo
                  ? 'API 키 없이 만든 예시입니다. 실제 Gemini 평가는 키를 연결하면 받을 수 있어요.'
                  : '공식 면접 점수가 아닌 비공식 연습 결과입니다. 근거로 표시된 #U1, #U2는 아래 전체 발언의 내 발언 번호입니다.'}
              </p>
            </section>

            {hasPrep || deliverable ? (
              <section className="card deliverable-card">
                <div className="card-head">
                  <h2>내 토의 자료</h2>
                  {deliverable ? <span className="chip chip-soft">공동 결과물</span> : null}
                </div>
                {hasPrep ? (
                  <details className="prep-summary is-flat">
                    <summary>
                      <span className="prep-summary-label">📝 1단계 준비 메모</span>
                      <span className="prep-summary-hint">펼쳐 보기</span>
                    </summary>
                    <dl>
                      {prepNotes?.position ? (
                        <div>
                          <dt>입장·기준</dt>
                          <dd>{prepNotes.position}</dd>
                        </div>
                      ) : null}
                      {prepNotes?.evidence ? (
                        <div>
                          <dt>근거</dt>
                          <dd>{prepNotes.evidence}</dd>
                        </div>
                      ) : null}
                      {prepNotes?.expectedViews ? (
                        <div>
                          <dt>다른 관점</dt>
                          <dd>{prepNotes.expectedViews}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>
                ) : null}
                {deliverable ? <pre className="deliverable-text">{deliverable}</pre> : null}
              </section>
            ) : null}

            <section className="criteria">
              <h2 className="section-title">다섯 가지 기준</h2>
              {feedback.criteria.map(criterion => (
                <article key={criterion.key} className="criterion card">
                  <div className="criterion-head">
                    <span className="criterion-name">
                      {criterion.label}
                      <small className="criterion-axis">{criterionAxis[criterion.key]}</small>
                    </span>
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
                  {criterion.improvement ? (
                    <p className="criterion-tip">
                      <span>다음엔</span>
                      {criterion.improvement}
                    </p>
                  ) : null}
                </article>
              ))}
            </section>

            {followUps.length ? (
              <section className="card followups-card">
                <h2 className="section-title">🎤 예상 꼬리질문 3개 · 1:1 방어 리허설</h2>
                <p className="fine-print">
                  내 발언과 공동 결과물을 그대로 짚은 질문입니다. 답변을 써 보면 3줄 코칭을 받을 수 있어요.
                </p>
                <ul className="followup-list">
                  {followUps.map((followUp, index) => (
                    <FollowUpCard
                      key={`${followUp.question}-${index}`}
                      index={index}
                      followUp={followUp}
                      onRehearsal={onRehearsal}
                      demo={!!feedback.demo}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {feedback.strengths.length || feedback.improvements.length ? (
              <section className="card lists-card">
                {feedback.strengths.length ? (
                  <div>
                    <h3 className="list-title good">잘한 점</h3>
                    <ul>
                      {feedback.strengths.map((item, index) => (
                        <li key={`s-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {feedback.improvements.length ? (
                  <div>
                    <h3 className="list-title improve">보완할 점</h3>
                    <ul>
                      {feedback.improvements.map((item, index) => (
                        <li key={`i-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {feedback.rewrites.length ? (
              <section className="card rewrites-card">
                <h2 className="section-title">이렇게 바꿔 말해 보세요</h2>
                {feedback.rewrites.map((rewrite, index) => (
                  <div key={`r-${index}`} className="rewrite">
                    {rewrite.original ? (
                      <p className="rewrite-original">
                        <span>원문</span>
                        {rewrite.original}
                      </p>
                    ) : null}
                    <p className="rewrite-improved">
                      <span>제안</span>
                      {rewrite.improved}
                    </p>
                    {rewrite.why ? <p className="rewrite-why">{rewrite.why}</p> : null}
                  </div>
                ))}
              </section>
            ) : null}

            {feedback.nextSteps.length ? (
              <section className="card next-card">
                <h2 className="section-title">다음 토의에서</h2>
                <ul>
                  {feedback.nextSteps.map((step, index) => (
                    <li key={`n-${index}`}>{step}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        <details className="card transcript-card">
          <summary>
            <span>전체 발언 다시 보기</span>
            <span className="summary-hint">{messages.length}개</span>
          </summary>
          <ol className="transcript-list">
            {messages.map(message => (
              <li key={message.id} className={message.speakerId === 'user' ? 'is-user' : ''}>
                <span className="transcript-name">
                  {message.speakerId === 'user'
                    ? `나${utteranceIds.has(message.id) ? ` · ${utteranceIds.get(message.id)}` : ''}`
                    : nameOf(message.speakerId)}
                  {message.stage === 'stage3' ? ' · 2차 토의' : ''}
                </span>
                <p>{message.text}</p>
              </li>
            ))}
          </ol>
        </details>

        <div className="feedback-actions">
          <button className="primary-button" onClick={onRestart}>
            같은 주제로 다시
          </button>
          <button className="soft-button" onClick={onNewTopic}>
            새 주제 고르기
          </button>
          <button className="ghost-button" onClick={onOpenHistory}>
            과거 기록
          </button>
        </div>
      </div>
    </div>
  )
}
