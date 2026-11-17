import type { DebateTopic } from '../types'
import { jointDeliverableSections } from '../logic/stages'
import { estimateSpeech } from '../logic/speechRate'

/** 4단계 공동 결과물 협업 에디터 */
export function JointDeliverable({
  topic,
  value,
  onChange,
  onDraft,
  onReview,
  onFinish,
  busy,
  reviewLines,
  draftNotice,
  proposal,
  onApplyProposal,
  onDismissProposal,
  demo,
}: {
  topic: DebateTopic
  value: string
  onChange: (text: string) => void
  onDraft: () => void
  onReview: () => void
  onFinish: () => void
  busy: 'draft' | 'review' | null
  reviewLines: string[]
  draftNotice: string | null
  proposal: string | null
  onApplyProposal: () => void
  onDismissProposal: () => void
  demo: boolean
}) {
  const filled = value.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, '').length
  return (
    <div className="joint-editor">
      <div className="joint-head">
        <div>
          <span className="eyebrow">4단계 · 공동 결과물 작성 · 10분</span>
          <h2>우리 조의 합의안</h2>
        </div>
        <span className={filled > 40 ? 'joint-count is-ok' : 'joint-count'}>{filled}자</span>
      </div>

      <p className="joint-guide">
        {topic.context?.goal ?? '4개 항목을 채워 우리 조의 합의안을 완성하세요.'} 작성한 내용은 피드백과 함께 저장됩니다.
      </p>

      {topic.additionalPerspective ? (
        <details className="joint-perspective">
          <summary>💡 3단계 추가 관점 다시 보기</summary>
          <p>{topic.additionalPerspective}</p>
        </details>
      ) : null}

      <ul className="joint-sections">
        {jointDeliverableSections.map(section => (
          <li key={section.key}>
            <strong>{section.label}</strong>
            <small>{section.hint}</small>
          </li>
        ))}
      </ul>

      <textarea
        className="text-input joint-textarea"
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={12}
        spellCheck={false}
        aria-label="공동 결과물 작성"
      />

      <div className="joint-actions">
        <button type="button" className="soft-button" onClick={onDraft} disabled={busy !== null}>
          {busy === 'draft' ? '팀원이 초안 작성 중…' : '✨ AI 팀원과 초안 만들기'}
        </button>
        <button type="button" className="soft-button" onClick={onReview} disabled={busy !== null || filled < 20}>
          {busy === 'review' ? '살펴보는 중…' : '보완 피드백 받기'}
        </button>
      </div>
      {demo ? <p className="fine-print">데모 모드에서는 예시 초안·피드백이 만들어집니다. API 키를 연결하면 실제 토의 내용으로 생성됩니다.</p> : null}
      {draftNotice ? <p className="notice notice-info">{draftNotice}</p> : null}

      {proposal ? (
        <div className="draft-proposal">
          <div className="draft-proposal-head">
            <strong>✨ 팀원이 제안한 초안</strong>
            <button type="button" className="link-button" onClick={onDismissProposal}>
              닫기
            </button>
          </div>
          <pre>{proposal}</pre>
          <button type="button" className="soft-button" onClick={onApplyProposal}>
            이 초안을 에디터에 반영
          </button>
        </div>
      ) : null}

      {reviewLines.length ? (
        <ul className="joint-review">
          {reviewLines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}

      <button type="button" className="primary-button" onClick={onFinish}>
        토의 종료 및 피드백 받기
      </button>
      <p className="fine-print">
        결과물 발표 길이는 {estimateSpeech(value).label || '아직 비어 있어요'}. 4단계에서는 결과물을 1분 안에 설명할 수 있어야 합니다.
      </p>
    </div>
  )
}
