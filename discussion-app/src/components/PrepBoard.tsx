import type { DebateTopic, PrepNotes } from '../types'
import { participants } from '../data/participants'
import { lensOf } from '../logic/perspectives'

/** 1단계 개인 의견 준비 보드 (5분) */
export function PrepBoard({
  topic,
  notes,
  onChange,
  onStart,
}: {
  topic: DebateTopic
  notes: PrepNotes
  onChange: (patch: Partial<PrepNotes>) => void
  onStart: () => void
}) {
  return (
    <div className="stage-panel">
      <section className="card stage-intro">
        <span className="eyebrow">1단계 · 개인 의견 준비 · 5분</span>
        <p>{topic.context?.situation}</p>
        {topic.context?.keyIssue ? (
          <p className="topic-issue">
            <span>쟁점</span>
            {topic.context.keyIssue}
          </p>
        ) : null}
        {topic.context?.goal ? (
          <p className="prep-goal">
            <span>결과물 목표</span>
            {topic.context.goal}
          </p>
        ) : null}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>내 의견 메모</h2>
          <span className="section-note">2·3·4단계에서도 계속 볼 수 있어요</span>
        </div>
        <label className="field-block">
          <span className="field-label">핵심 입장·기준</span>
          <textarea
            className="text-input text-area"
            rows={2}
            maxLength={300}
            placeholder="나는 무엇을 가장 중요한 기준으로 볼 것인가"
            value={notes.position}
            onChange={event => onChange({ position: event.target.value })}
          />
        </label>
        <label className="field-block">
          <span className="field-label">주요 근거</span>
          <textarea
            className="text-input text-area"
            rows={2}
            maxLength={400}
            placeholder="경험이나 사례, 이유"
            value={notes.evidence}
            onChange={event => onChange({ evidence: event.target.value })}
          />
        </label>
        <label className="field-block">
          <span className="field-label">예상되는 다른 관점</span>
          <textarea
            className="text-input text-area"
            rows={2}
            maxLength={400}
            placeholder="다른 사람이 걱정할 지점, 내가 답해야 할 반대 의견"
            value={notes.expectedViews}
            onChange={event => onChange({ expectedViews: event.target.value })}
          />
        </label>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>함께 토의할 팀원</h2>
        </div>
        <ul className="member-list">
          {participants
            .filter(person => person.id !== 'user')
            .map(person => (
              <li key={person.id}>
                <span className={`avatar ${person.id === 'ai1' ? 'tone-blue' : person.id === 'ai2' ? 'tone-rose' : 'tone-green'}`}>
                  {person.initials}
                </span>
                <span className="member-copy">
                  <strong>
                    {person.name} · {lensOf(person.id as 'ai1' | 'ai2' | 'ai3').label}
                  </strong>
                  <small>{lensOf(person.id as 'ai1' | 'ai2' | 'ai3').description}</small>
                </span>
              </li>
            ))}
        </ul>
      </section>

      <button type="button" className="primary-button" onClick={onStart}>
        1차 토의 시작하기
      </button>
    </div>
  )
}

/** 2~4단계에서 내 준비 메모를 접어서 다시 보는 카드 */
export function PrepSummary({ notes }: { notes: PrepNotes }) {
  const rows = [
    { label: '입장·기준', value: notes.position },
    { label: '근거', value: notes.evidence },
    { label: '다른 관점', value: notes.expectedViews },
  ].filter(row => row.value.trim())
  if (!rows.length) return null
  return (
    <details className="prep-summary">
      <summary>
        <span className="prep-summary-label">📝 1단계 내 준비 메모</span>
        <span className="prep-summary-hint">{rows.length}개 · 펼쳐 보기</span>
      </summary>
      <dl>
        {rows.map(row => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
