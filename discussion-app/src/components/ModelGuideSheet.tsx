import { useState } from 'react'
import type { DebateTopic } from '../types'
import { Sheet } from './Sheet'

const copy = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="guide-block">
      <div className="guide-block-head">
        <span>{label}</span>
        <button
          type="button"
          className="link-button"
          onClick={async () => {
            const ok = await copy(text)
            setDone(ok)
            window.setTimeout(() => setDone(false), 1600)
          }}
        >
          {done ? '복사됨' : '복사'}
        </button>
      </div>
      <p>{text}</p>
    </div>
  )
}

/** 📖 모범 토의 & 결과물 보기 — 공부 모드 */
export function ModelGuideSheet({
  topic,
  open,
  onClose,
}: {
  topic: DebateTopic | null
  open: boolean
  onClose: () => void
}) {
  const guide = topic?.modelGuide
  return (
    <Sheet
      open={open && !!topic}
      title="📖 모범 토의 & 결과물"
      subtitle="연습용 예시입니다. 그대로 외우기보다 구조를 참고하세요"
      onClose={onClose}
    >
      {topic && guide ? (
        <>
          <section className="guide-topic">
            <span className="chip chip-soft">{topic.category}</span>
            <h3>{topic.title}</h3>
            {topic.context?.goal ? <p className="fine-print">결과물 목표: {topic.context.goal}</p> : null}
          </section>

          <section className="guide-section">
            <h3>핵심 관점 3가지</h3>
            <ul className="guide-perspectives">
              {guide.perspectives.map((line, index) => (
                <li key={index}>
                  <span className={`avatar ${index === 0 ? 'tone-blue' : index === 1 ? 'tone-rose' : 'tone-green'}`}>
                    {['민', '서', '도'][index]}
                  </span>
                  <p>{line}</p>
                </li>
              ))}
            </ul>
          </section>

          {topic.additionalPerspective ? (
            <section className="guide-section">
              <h3>💡 3단계 추가 관점</h3>
              <p className="guide-perspective-text">{topic.additionalPerspective}</p>
            </section>
          ) : null}

          <section className="guide-section">
            <h3>모범 토의</h3>
            <CopyBlock label="30초 첫 발언 예시" text={guide.openingExample} />
            <CopyBlock label="추가 관점 조율 멘트" text={guide.synthesisExample} />
          </section>

          <section className="guide-section">
            <h3>모범 공동 결과물</h3>
            <CopyBlock label="4개 항목 완성 예시" text={guide.jointDeliverableExample} />
          </section>

          <p className="fine-print">
            실제 면접 주제·평가와 무관한 연습용 예시입니다. 토의에서 나온 내용과 다르면 우리 조의 합의를 우선하세요.
          </p>
        </>
      ) : null}
    </Sheet>
  )
}
