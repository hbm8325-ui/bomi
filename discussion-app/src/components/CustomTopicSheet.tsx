import { useEffect, useState } from 'react'
import type { DebateTopic } from '../types'
import { Sheet } from './Sheet'

export function CustomTopicSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (topic: DebateTopic) => void
}) {
  const [title, setTitle] = useState('')
  const [situation, setSituation] = useState('')
  const [keyIssue, setKeyIssue] = useState('')
  const [perspective, setPerspective] = useState('')

  useEffect(() => {
    if (!open) {
      setTitle('')
      setSituation('')
      setKeyIssue('')
      setPerspective('')
    }
  }, [open])

  const ready = title.trim().length >= 5

  return (
    <Sheet
      open={open}
      title="주제 직접 입력"
      subtitle="면접에서 받을 법한 질문을 그대로 넣어 보세요"
      onClose={onClose}
      footer={
        <button
          className="primary-button"
          disabled={!ready}
          onClick={() =>
            onCreate({
              id: `custom-${Date.now()}`,
              title: title.trim(),
              category: '직접 입력',
              source: 'custom',
              ...(perspective.trim() ? { additionalPerspective: perspective.trim() } : {}),
              ...(situation.trim() || keyIssue.trim()
                ? {
                    context: {
                      ...(situation.trim() ? { situation: situation.trim() } : {}),
                      ...(keyIssue.trim() ? { keyIssue: keyIssue.trim() } : {}),
                    },
                  }
                : {}),
            })
          }
        >
          이 주제로 시작
        </button>
      }
    >
      <label className="field-block">
        <span className="field-label">주제 (필수)</span>
        <textarea
          className="text-input text-area"
          rows={2}
          maxLength={200}
          placeholder="예: 능력보다 태도가 중요하다는 말은 채용에서 공정한가?"
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
        <span className="field-count">{title.length}/200</span>
      </label>
      <label className="field-block">
        <span className="field-label">상황 (선택)</span>
        <textarea
          className="text-input text-area"
          rows={3}
          maxLength={600}
          placeholder="회사가 채용 기준을 바꾸려 합니다. 지원자들은…"
          value={situation}
          onChange={event => setSituation(event.target.value)}
        />
      </label>
      <label className="field-block">
        <span className="field-label">핵심 쟁점 (선택)</span>
        <textarea
          className="text-input text-area"
          rows={2}
          maxLength={300}
          placeholder="무엇을 기준으로 공정함을 판단할까요?"
          value={keyIssue}
          onChange={event => setKeyIssue(event.target.value)}
        />
      </label>
      <label className="field-block">
        <span className="field-label">3단계 추가 관점 (선택)</span>
        <textarea
          className="text-input text-area"
          rows={3}
          maxLength={400}
          placeholder="토의 중반에 새로 던질 조건이나 반대 상황. 비워 두면 이 단계에서 조건을 다시 점검합니다."
          value={perspective}
          onChange={event => setPerspective(event.target.value)}
        />
      </label>
      <p className="fine-print">
        상황·쟁점을 비우면 제목만으로 토의합니다. 추가 관점을 비워 두면 3단계에서 AI가 지금까지의 논의를 다시 점검합니다.
        AI가 없는 배경을 사실처럼 만들지 않도록 지시합니다.
      </p>
    </Sheet>
  )
}
