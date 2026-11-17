import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSpeech } from '../hooks/useSpeech'
import { estimateSpeech } from '../logic/speechRate'

export function Composer({
  onSend,
  onInterrupt,
  disabled,
  hint,
  placeholder = '내 생각을 말해 보세요',
  showTiming = false,
}: {
  onSend: (text: string, source: 'text' | 'speech') => void
  onInterrupt: () => void
  disabled?: boolean
  hint?: ReactNode
  placeholder?: string
  /** 실시간 예상 발화 시간 안내 (분당 약 300자 기준) */
  showTiming?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const speech = useSpeech('ko-KR')

  useEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`
  }, [draft])

  useEffect(() => {
    if (speech.error) setNotice(speech.error)
  }, [speech.error])

  const send = (text: string, source: 'text' | 'speech') => {
    const value = text.trim()
    if (!value || disabled) return
    onSend(value, source)
    setDraft('')
    setNotice(null)
    speech.reset()
  }

  const startListening = () => {
    if (disabled) return
    onInterrupt()
    if (!speech.supported) {
      setNotice('이 브라우저는 음성 인식을 지원하지 않아요. 아래 입력창에 직접 적어 주세요.')
      textareaRef.current?.focus()
      return
    }
    setNotice(null)
    speech.start()
  }

  const stopAndEdit = () => {
    const text = speech.text
    speech.stop()
    speech.reset()
    if (text) setDraft(previous => (previous ? `${previous} ${text}` : text).trim())
    window.setTimeout(() => textareaRef.current?.focus(), 60)
  }

  const sendSpoken = () => {
    const text = speech.text
    speech.stop()
    if (text) send(text, 'speech')
  }

  const timing = estimateSpeech(draft)

  return (
    <div className="composer">
      {hint ? <div className="composer-hint">{hint}</div> : null}
      {showTiming && timing.label ? (
        <p className={`speak-timing is-${timing.tone}`} aria-live="polite">
          <span aria-hidden="true">⏱</span>
          {timing.label}
        </p>
      ) : null}
      {notice ? (
        <p className="composer-notice">
          {notice}
          <button onClick={() => setNotice(null)} aria-label="안내 닫기">
            ×
          </button>
        </p>
      ) : null}

      {speech.listening ? (
        <div className="listen-panel">
          <div className="listen-head">
            <span className="pulse" aria-hidden="true" />
            <span className="listen-label">듣고 있어요</span>
          </div>
          <p className={speech.text ? 'listen-text' : 'listen-text is-empty'}>
            {speech.text || '편하게 말씀하세요. 말이 끝나면 멈추고 수정할 수 있어요.'}
          </p>
          <div className="listen-actions">
            <button className="soft-button" onClick={stopAndEdit}>
              멈추고 수정
            </button>
            <button className="primary-button small" onClick={sendSpoken} disabled={!speech.text.trim()}>
              바로 전송
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="composer-row">
            <button
              className="mic-button"
              onClick={startListening}
              disabled={disabled}
              aria-label="음성으로 말하기"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span>말하기</span>
            </button>
            <textarea
              ref={textareaRef}
              className="composer-input"
              rows={1}
              value={draft}
              placeholder={placeholder}
              disabled={disabled}
              onFocus={onInterrupt}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  send(draft, 'text')
                }
              }}
            />
            <button
              className="send-button"
              onClick={() => send(draft, 'text')}
              disabled={disabled || !draft.trim()}
              aria-label="보내기"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M4 11.5L20 4l-3.4 16-5.1-6.1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <path d="M11.5 13.9L20 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p className="composer-note">
            {speech.supported ? '말하기를 누르고 말한 뒤, 바로 전송하거나 멈추고 고칠 수 있어요.' : '음성 인식이 없는 브라우저예요. 입력창에 직접 적어 주세요.'}
          </p>
        </>
      )}
    </div>
  )
}
