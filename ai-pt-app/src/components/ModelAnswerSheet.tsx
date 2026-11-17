import { useState } from 'react'
import type { Scenario } from '../types'
import { Sheet } from './Sheet'
import { copyText } from '../logic/clipboard'
import { difficultyOf } from '../data/scenarios'

type Props = {
  scenario: Scenario
  onClose: () => void
}

/** 시험을 시작하지 않아도 읽고 복사할 수 있는 모범답안 시트 */
export function ModelAnswerSheet({ scenario, onClose }: Props) {
  const answer = scenario.modelAnswer
  const [copied, setCopied] = useState('')

  const copy = async (key: string, text: string) => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(key)
      setTimeout(() => setCopied(''), 1800)
    }
  }

  return (
    <Sheet
      title={`📖 모범답안 · ${scenario.code}`}
      subtitle={`${difficultyOf(scenario)} · ${scenario.field} · ${scenario.title}`}
      onClose={onClose}
      size="lg"
      footer={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          닫기
        </button>
      }
    >
      {!answer ? (
        <p className="empty-note">이 과제에는 모범답안이 없습니다. 내가 추가한 과제에서 직접 작성했거나, JSON에 modelAnswer가 없었습니다.</p>
      ) : (
        <>
          <div className="ma-head">
            <h3 className="sheet-section-title">제출용 보고서</h3>
            <span className="muted">{Array.from(answer.report).length.toLocaleString()}자</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy('report', answer.report)}>
              {copied === 'report' ? '✓ 복사됨' : '📋 보고서 복사'}
            </button>
          </div>
          <pre className="model-answer-report">{answer.report}</pre>

          {answer.points.length ? (
            <>
              <h3 className="sheet-section-title">핵심 설계 포인트 — 왜 이 결론인가</h3>
              <ol className="ma-points">
                {answer.points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ol>
            </>
          ) : null}

          {answer.samplePrompts.length ? (
            <>
              <div className="ma-head">
                <h3 className="sheet-section-title">추천 AI 질문</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => copy('prompts', answer.samplePrompts.map((prompt, index) => `${index + 1}. ${prompt}`).join('\n'))}
                >
                  {copied === 'prompts' ? '✓ 복사됨' : '📋 질문 전체 복사'}
                </button>
              </div>
              <ul className="ma-prompts">
                {answer.samplePrompts.map((prompt, index) => (
                  <li key={index}>
                    <p>{prompt}</p>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => copy(`prompt-${index}`, prompt)}>
                      {copied === `prompt-${index}` ? '✓' : '복사'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="ma-note">
            모범답안은 정답이 아니라 하나의 좋은 답안입니다. 내 답안과 비교해 결론 위치, 근거의 수, 대가(일정·비용) 서술, 실행계획의
            주체·시점이 빠지지 않았는지 확인해 보세요.
          </p>
        </>
      )}
    </Sheet>
  )
}
