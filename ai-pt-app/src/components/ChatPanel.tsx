import { useEffect, useRef } from 'react'
import type { ChatMessage, Scenario } from '../types'
import { CHAT_INPUT_LIMIT, countChars } from '../logic/text'

type Props = {
  scenario: Scenario
  chat: ChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  loading: boolean
  coachOn: boolean
  onToggleCoach: (value: boolean) => void
  demoMode: boolean
}

export function ChatPanel({
  scenario,
  chat,
  input,
  onInputChange,
  onSend,
  loading,
  coachOn,
  onToggleCoach,
  demoMode,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const inputCount = countChars(input)

  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [chat.length, loading])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <section className="panel panel-chat" aria-label="AI Agent 채팅">
      <header className="panel-head">
        <h2>
          AI Agent <span className="muted">({scenario.field})</span>
        </h2>
        <div className="head-tools">
          <span className={`badge ${demoMode ? 'badge-demo' : 'badge-live'}`}>{demoMode ? '데모' : 'Gemini 연결'}</span>
          <label className="switch" title="넓은 프롬프트를 감지해 팁을 보여 줍니다">
            <input type="checkbox" checked={coachOn} onChange={event => onToggleCoach(event.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span className="switch-label">연습 코치 {coachOn ? 'ON' : 'OFF'}</span>
          </label>
        </div>
      </header>

      <div className="chat-box" ref={boxRef}>
        {chat.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-msg msg-ai">
              안녕하세요. 문제 해결을 돕는 AI Agent입니다. 참고자료 요약이나 대안 비교가 필요하면 질문해 주세요.
            </p>
            <p className="chat-hint">
              실제 시험과 같이, 넓게 물으면 원론적인 답이 돌아옵니다. 표·수치·단위를 지정해 좁게 물어보세요.
            </p>
          </div>
        ) : null}

        {chat.map(message => (
          <div key={message.id} className={`chat-msg ${message.role === 'user' ? 'msg-user' : 'msg-ai'} ${message.error ? 'is-error' : ''}`}>
            <div className="msg-head">
              <strong>{message.role === 'user' ? '지원자' : '🤖 AI Agent'}</strong>
              {message.demo ? <span className="badge badge-demo">데모 응답</span> : null}
            </div>
            <div className="msg-text">{message.text}</div>
            {message.coachTip ? <div className="coach-tip">{message.coachTip}</div> : null}
          </div>
        ))}

        {loading ? (
          <div className="chat-msg msg-ai is-loading">
            <div className="msg-head">
              <strong>🤖 AI Agent</strong>
            </div>
            <div className="msg-text">자료를 확인하는 중…</div>
          </div>
        ) : null}
      </div>

      <div className="chat-input-area">
        <textarea
          value={input}
          rows={2}
          placeholder="AI에게 질문할 내용 (Enter 전송 / Shift+Enter 줄바꿈)"
          onChange={event => onInputChange(event.target.value.slice(0, CHAT_INPUT_LIMIT))}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
        <div className="chat-input-foot">
          <span className={`counter ${inputCount >= CHAT_INPUT_LIMIT ? 'is-over' : inputCount > 3600 ? 'is-warn' : ''}`}>
            {inputCount.toLocaleString()} / {CHAT_INPUT_LIMIT.toLocaleString()}
          </span>
          <button type="button" className="btn btn-dark" onClick={onSend} disabled={loading || !input.trim()}>
            전송
          </button>
        </div>
      </div>
    </section>
  )
}
