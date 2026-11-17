import { useState } from 'react'
import type { FollowUp, GradeResult, Scenario } from '../types'
import { copyText } from '../logic/clipboard'
import { formatClock } from '../logic/text'

type Props = {
  scenario: Scenario | null
  fallbackTitle: string
  grade: GradeResult
  answer: string
  chatTurns: number
  durationSec: number
  loading: boolean
  error: string
  autoSubmitted: boolean
  onRetry: () => void
  onOpenPicker: () => void
  onOpenHistory: () => void
  onRehearsal: (followUp: FollowUp, defense: string) => Promise<string[]>
}

function ScoreRing({ total }: { total: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const ratio = Math.max(0, Math.min(1, total / 100))
  return (
    <div className="score-ring">
      <svg viewBox="0 0 120 120" role="img" aria-label={`총점 ${total}점`}>
        <circle cx="60" cy="60" r={radius} className="ring-bg" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="ring-value"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="score-ring-text">
        <strong>{Math.round(total)}</strong>
        <span>/ 100</span>
      </div>
    </div>
  )
}

function FollowUpCard({
  index,
  followUp,
  onRehearsal,
}: {
  index: number
  followUp: FollowUp
  onRehearsal: (followUp: FollowUp, defense: string) => Promise<string[]>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(followUp.rehearsal ?? '')
  const [lines, setLines] = useState<string[]>(followUp.rehearsalFeedback ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await onRehearsal(followUp, text)
      setLines(result)
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
      <p className="followup-intent">의도: {followUp.intent}</p>
      {followUp.quote ? <p className="followup-quote">“{followUp.quote}”</p> : null}
      <ul className="followup-points">
        {followUp.points.map((point, pointIndex) => (
          <li key={pointIndex}>{point}</li>
        ))}
      </ul>

      {!open ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          🎤 내 방어 답변 써보고 피드백 받기
        </button>
      ) : (
        <div className="rehearsal-box">
          <textarea
            rows={3}
            value={text}
            placeholder="면접관에게 말하듯 3~4문장으로 방어 답변을 써 보세요."
            onChange={event => setText(event.target.value)}
          />
          <div className="rehearsal-actions">
            <span className="muted">{text.trim().length}자</span>
            <button type="button" className="btn btn-dark btn-sm" onClick={submit} disabled={loading || !text.trim()}>
              {loading ? '피드백 작성 중…' : '피드백 받기'}
            </button>
          </div>
          {error ? <p className="status-line is-error">{error}</p> : null}
          {lines.length ? (
            <ul className="rehearsal-feedback">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </li>
  )
}

export function FeedbackScreen({
  scenario,
  fallbackTitle,
  grade,
  answer,
  chatTurns,
  durationSec,
  loading,
  error,
  autoSubmitted,
  onRetry,
  onOpenPicker,
  onOpenHistory,
  onRehearsal,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [answerOpen, setAnswerOpen] = useState(true)
  const [modelCopied, setModelCopied] = useState(false)

  if (loading) {
    return (
      <div className="feedback-screen">
        <div className="feedback-loading">
          <div className="spinner" aria-hidden="true" />
          <h2>답안과 AI 대화 로그를 채점하고 있습니다…</h2>
          <p>4개 항목 점수 · 함정 탐지 · 압박 꼬리질문 4개 · 1분 30초 발표 뼈대를 만들고 있어요. (10~30초)</p>
        </div>
      </div>
    )
  }

  const script = grade.presentation
  const scriptText = [
    '[0:00–0:15 오픈]',
    script.hook,
    '',
    '[0:15–0:45 문제 정의]',
    script.frame,
    '',
    '[0:45–1:20 해결·근거]',
    script.solution,
    '',
    '[1:20–1:30 마무리]',
    script.close,
  ].join('\n')

  const copyScript = async () => {
    const ok = await copyText(scriptText)
    setCopied(ok)
    setTimeout(() => setCopied(false), 2000)
  }

  const model = scenario?.modelAnswer
  const modelText = model
    ? [
        '[모범답안]',
        model.report,
        '',
        '[핵심 설계 포인트]',
        ...model.points.map((point, index) => `${index + 1}. ${point}`),
        '',
        '[추천 AI 질문]',
        ...model.samplePrompts.map((prompt, index) => `${index + 1}. ${prompt}`),
      ].join('\n')
    : ''

  const copyModel = async () => {
    const ok = await copyText(modelText)
    setModelCopied(ok)
    setTimeout(() => setModelCopied(false), 2000)
  }

  return (
    <div className="feedback-screen">
      <header className="feedback-head">
        <div>
          <p className="muted">
            {scenario ? `${scenario.code} · ${scenario.field}` : '지난 기록'} · 답안 {answer.length.toLocaleString()}자 · AI 질문{' '}
            {chatTurns}회 · 소요 {formatClock(durationSec)}
            {autoSubmitted ? ' · 시간 종료 자동 제출' : ''}
          </p>
          <h1>{scenario?.title ?? fallbackTitle}</h1>
        </div>
        <div className="feedback-actions">
          <button type="button" className="btn btn-ghost" onClick={onOpenHistory}>
            🗂 기록
          </button>
          <button type="button" className="btn btn-ghost" onClick={onOpenPicker}>
            과제 선택
          </button>
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            같은 과제로 다시 연습
          </button>
        </div>
      </header>

      {error ? <div className="warning-box">⚠ {error}</div> : null}

      <section className="feedback-top">
        <div className="score-card">
          <ScoreRing total={grade.total} />
          <div className="score-side">
            <span className={`badge ${grade.demo ? 'badge-demo' : 'badge-live'}`}>
              {grade.demo ? '로컬 채점(데모)' : `Gemini 채점${grade.model ? ` · ${grade.model}` : ''}`}
            </span>
            <p className="score-overall">{grade.overall}</p>
          </div>
        </div>

        <div className="items-card">
          {grade.items.map(item => (
            <div key={item.key} className="score-item">
              <div className="score-item-head">
                <strong>{item.label}</strong>
                <span>
                  <b>{item.score}</b> / {item.max}
                </span>
              </div>
              <div className="bar">
                <span style={{ width: `${Math.max(0, Math.min(100, (item.score / item.max) * 100))}%` }} />
              </div>
              <p className="score-comment">{item.comment}</p>
              {item.evidence ? <p className="score-evidence">근거: {item.evidence}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="feedback-card model-answer-card">
        <div className="card-head-row">
          <h2>📖 모범답안 &amp; 추천 AI 질문</h2>
          <div className="card-actions">
            {model ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={copyModel}>
                {modelCopied ? '✓ 복사됨' : '📋 모범답안 복사'}
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAnswerOpen(prev => !prev)}>
              {answerOpen ? '접기' : '펼치기'}
            </button>
          </div>
        </div>
        {!model ? (
          <p className="muted">이 과제에는 모범답안이 없습니다.</p>
        ) : answerOpen ? (
          <>
            <p className="muted">
              내 답안과 나란히 놓고 보세요. 결론이 첫 문단에 있는지, 근거가 몇 개인지, 대가(일정·비용)를 적었는지, 실행계획에 주체와
              시점이 있는지를 먼저 비교하면 빠릅니다.
            </p>
            <pre className="model-answer-report">{model.report}</pre>
            {model.points.length ? (
              <>
                <h3 className="mini-title">왜 이렇게 결론을 잡았나</h3>
                <ol className="ma-points">
                  {model.points.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ol>
              </>
            ) : null}
            {model.samplePrompts.length ? (
              <>
                <h3 className="mini-title">이 문제에서 AI에게 이렇게 물어보면 좋습니다</h3>
                <ul className="ma-prompts">
                  {model.samplePrompts.map((prompt, index) => (
                    <li key={index}>
                      <p>{prompt}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="feedback-grid">
        <article className="feedback-card">
          <h2>🔍 숨은 함정 탐지 리포트</h2>
          <ul className="trap-list">
            {grade.traps.map((trap, index) => (
              <li key={index} className={trap.found ? 'is-found' : 'is-missed'}>
                <span className="trap-mark">{trap.found ? '✓ 짚음' : '✗ 놓침'}</span>
                <div>
                  <strong>{trap.title}</strong>
                  <p>{trap.evidence || '근거 없음'}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="feedback-card">
          <h2>📌 총평</h2>
          <h3 className="mini-title">잘한 점</h3>
          <ul className="bullet-list">
            {grade.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <h3 className="mini-title">보완할 점</h3>
          <ul className="bullet-list">
            {grade.improvements.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="feedback-card">
        <h2>🎤 예상 압박 꼬리질문 4개 · 1:1 리허설</h2>
        <p className="muted">
          실제 심층 인터뷰 PT 질의응답(15분)에서 나올 질문입니다. 답변을 써 보면 결론 먼저 / 자료 근거 / 놓친 리스크 기준으로
          바로 코칭합니다.
        </p>
        <ol className="followup-list">
          {grade.followUps.map((followUp, index) => (
            <FollowUpCard key={index} index={index} followUp={followUp} onRehearsal={onRehearsal} />
          ))}
        </ol>
      </section>

      <section className="feedback-card">
        <div className="card-head-row">
          <h2>⏱ 1분 30초 발표 뼈대</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyScript}>
            {copied ? '✓ 복사됨' : '📋 스크립트 복사'}
          </button>
        </div>
        <div className="script-grid">
          <div className="script-part">
            <span className="script-time">0:00–0:15</span>
            <h3>오픈 · 결론</h3>
            <p>{script.hook}</p>
          </div>
          <div className="script-part">
            <span className="script-time">0:15–0:45</span>
            <h3>문제 정의</h3>
            <p>{script.frame}</p>
          </div>
          <div className="script-part">
            <span className="script-time">0:45–1:20</span>
            <h3>해결·근거</h3>
            <p>{script.solution}</p>
          </div>
          <div className="script-part">
            <span className="script-time">1:20–1:30</span>
            <h3>마무리</h3>
            <p>{script.close}</p>
          </div>
        </div>
      </section>

      <section className="feedback-card">
        <h2>📝 제출한 답안</h2>
        <pre className="answer-preview">{answer || '(답안 없음)'}</pre>
        {scenario?.mustAsk?.length ? (
          <div className="must-ask">
            <h3 className="mini-title">다음 연습 때 AI에게 물어볼 것</h3>
            <ul className="bullet-list">
              {scenario.mustAsk.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  )
}
