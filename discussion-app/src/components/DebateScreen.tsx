import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { DebateTopic, Message, Settings } from '../types'
import { nameOf } from '../data/participants'
import { flowDecision } from '../logic/turn'
import { paceLabel } from '../logic/storage'
import { styleLabel } from '../logic/perspectives'
import { stageGuide } from '../logic/stages'
import type { DebateEngine } from '../hooks/useDebate'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useTts } from '../hooks/useTts'
import { Composer } from './Composer'
import { StageBar } from './StageBar'
import { PrepBoard, PrepSummary } from './PrepBoard'
import { PerspectiveCard } from './PerspectiveCard'
import { JointDeliverable } from './JointDeliverable'

const personaClass: Record<string, string> = {
  ai1: 'tone-blue',
  ai2: 'tone-rose',
  ai3: 'tone-green',
}

export function DebateScreen({
  topic,
  settings,
  engine,
  onChange,
  onEnd,
  onExit,
  onOpenSettings,
  onOpenGuide,
  onDraft,
  onReview,
  aiBusy,
  reviewLines,
  draftNotice,
  draftProposal,
  onApplyProposal,
  onDismissProposal,
}: {
  topic: DebateTopic
  settings: Settings
  engine: DebateEngine
  onChange: (patch: Partial<Settings>) => void
  onEnd: () => void
  onExit: () => void
  onOpenSettings: () => void
  onOpenGuide: () => void
  onDraft: () => void
  onReview: () => void
  aiBusy: 'draft' | 'review' | null
  reviewLines: string[]
  draftNotice: string | null
  draftProposal: string | null
  onApplyProposal: () => void
  onDismissProposal: () => void
}) {
  useKeyboardInset()
  const threadRef = useRef<HTMLDivElement>(null)
  const { messages, thinking, speakingId, paused, error, stage } = engine
  const [pane, setPane] = useState<'editor' | 'chat'>('editor')
  const tts = useTts({ enabled: settings.tts, messages, paused: paused || engine.ended })

  useEffect(() => {
    const node = threadRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages.length, thinking, stage])

  const lastAiIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].speakerId !== 'user') return i
    }
    return -1
  }, [messages])

  const firstStage3 = useMemo(() => messages.findIndex(message => message.stage === 'stage3'), [messages])

  const floor = flowDecision(messages, settings.debateMode, engine.ended)
  const myTurn = !thinking && !paused && !engine.ended && messages.length > 0 && floor.reason !== 'idle'
  const aiTurnCount = messages.filter(m => m.speakerId !== 'user').length
  const isPrep = stage === 'stage1'
  const isJoint = stage === 'stage4'

  return (
    <div className="screen debate-screen">
      <header className="debate-head">
        <button className="icon-button" onClick={onExit} aria-label="토의 나가기">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M14.5 5L7.5 12l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="debate-head-copy">
          <span className="debate-cat">
            {topic.category} · 4단계 그룹 토의 · {styleLabel[settings.discussionStyle]}
          </span>
          <h1>{topic.title}</h1>
        </div>
        <button className="icon-button" onClick={onOpenGuide} aria-label="모범 토의 보기" title="📖 모범 토의 & 결과물">
          📖
        </button>
      </header>

      <StageBar stage={stage} paused={paused} onSelect={engine.goToStage} onNext={engine.nextStage} />

      <div className="debate-tools">
        <div className="tool-chips">
          <button
            className={settings.displayMode === 'real' ? 'chip is-on' : 'chip'}
            onClick={() => onChange({ displayMode: settings.displayMode === 'real' ? 'normal' : 'real' })}
            aria-pressed={settings.displayMode === 'real'}
          >
            실전 모드 {settings.displayMode === 'real' ? 'ON' : 'OFF'}
          </button>
          <button
            className={settings.tts ? 'chip is-on' : 'chip'}
            onClick={() => onChange({ tts: !settings.tts })}
            aria-pressed={settings.tts}
            disabled={!tts.supported}
            title={tts.supported ? 'AI 발언을 음성으로 듣습니다' : '이 브라우저는 음성 재생을 지원하지 않아요'}
          >
            {tts.speaking ? '🔊 재생 중' : settings.tts ? '🔊 목소리 ON' : '🔇 목소리 OFF'}
          </button>
          <button className="chip" onClick={onOpenSettings}>
            {paceLabel(settings.pace)} · AI {aiTurnCount}
          </button>
        </div>
        <div className="tool-actions">
          <button
            className="ghost-button small"
            onClick={() => (paused ? engine.resume() : engine.pause())}
            disabled={engine.ended || isPrep}
          >
            {paused ? '재개' : '일시정지'}
          </button>
          <button className="ghost-button small accent" onClick={onEnd}>
            끝내기
          </button>
        </div>
      </div>

      {isPrep ? (
        <div className="stage-scroll">
          <p className="stage-guide">{stageGuide.stage1}</p>
          <PrepBoard
            topic={topic}
            notes={engine.prepNotes}
            onChange={engine.setPrepNotes}
            onStart={engine.nextStage}
          />
        </div>
      ) : null}

      {!isPrep && !isJoint ? (
        <>
          <div className="thread" ref={threadRef}>
            <p className="stage-guide is-inline">{stageGuide[stage]}</p>
            <PrepSummary notes={engine.prepNotes} />
            {stage === 'stage3' ? (
              <PerspectiveCard
                text={
                  topic.additionalPerspective?.trim() ||
                  '이 주제에는 별도로 정해 둔 추가 관점이 없습니다. 지금까지 논의에서 아직 정하지 못한 조건과 예외를 새로운 관점처럼 다시 점검해 보세요.'
                }
              />
            ) : null}

            {messages.map((message, index) => (
              <Fragment key={message.id}>
                {index === firstStage3 ? (
                  <div className="perspective-divider">
                    <span>💡 추가 관점 공개 · 2차 토의 시작</span>
                  </div>
                ) : null}
                <MessageRow
                  message={message}
                  covered={settings.displayMode === 'real' && !engine.ended && message.speakerId !== 'user' && index !== lastAiIndex}
                  isLatestAi={index === lastAiIndex}
                />
              </Fragment>
            ))}

            {thinking ? (
              <div className={`bubble ai-bubble ${personaClass[speakingId ?? 'ai1'] ?? 'tone-blue'}`}>
                <span className="avatar">{nameOf(speakingId ?? 'ai1').slice(0, 1)}</span>
                <div className="bubble-body">
                  <span className="bubble-name">{nameOf(speakingId ?? 'ai1')}</span>
                  <span className="typing">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="error-card">
                <strong>응답을 받지 못했어요</strong>
                <p>{error}</p>
                <div className="error-actions">
                  <button className="soft-button" onClick={engine.resume}>
                    다시 시도
                  </button>
                  <button className="soft-button" onClick={onOpenSettings}>
                    설정 열기
                  </button>
                </div>
              </div>
            ) : null}

            {paused && !error ? (
              <div className="paused-note">잠시 멈췄어요. 재개를 누르면 AI가 이어서 말합니다.</div>
            ) : null}

            <div className="thread-tail" aria-hidden="true" />
          </div>

          <div className="debate-foot">
            {myTurn ? (
              <div className="turn-hint">
                <span>당신 차례예요</span>
                <button className="link-button" onClick={engine.listenMore}>
                  팀원끼리 더 듣기
                </button>
              </div>
            ) : (
              <div className="turn-hint is-muted">
                <span>{thinking ? `${nameOf(speakingId ?? 'ai1')} 님이 말하는 중` : '언제든 말하기를 눌러 끼어들 수 있어요'}</span>
              </div>
            )}
            <Composer
              onSend={(text, source) => engine.sendUser(text, source)}
              onInterrupt={engine.interrupt}
              disabled={engine.ended}
              showTiming
              placeholder={myTurn ? '지금 내 관점이나 조율안을 말해 보세요' : '끼어들어 말하려면 여기에 적어도 됩니다'}
            />
          </div>
        </>
      ) : null}

      {isJoint ? (
        <div className="joint-layout">
          <div className="joint-pane-toggle" role="tablist" aria-label="4단계 화면 전환">
            <button
              role="tab"
              aria-selected={pane === 'editor'}
              className={pane === 'editor' ? 'chip is-on' : 'chip'}
              onClick={() => setPane('editor')}
            >
              결과물 작성
            </button>
            <button
              role="tab"
              aria-selected={pane === 'chat'}
              className={pane === 'chat' ? 'chip is-on' : 'chip'}
              onClick={() => setPane('chat')}
            >
              토의 다시 보기
            </button>
          </div>

          <div className={pane === 'editor' ? 'joint-scroll' : 'joint-scroll is-hidden-mobile'}>
            <PrepSummary notes={engine.prepNotes} />
            <JointDeliverable
              topic={topic}
              value={engine.jointDeliverable}
              onChange={engine.setJointDeliverable}
              onDraft={onDraft}
              onReview={onReview}
              onFinish={onEnd}
              busy={aiBusy}
              reviewLines={reviewLines}
              draftNotice={draftNotice}
              proposal={draftProposal}
              onApplyProposal={onApplyProposal}
              onDismissProposal={onDismissProposal}
              demo={engine.demo}
            />
          </div>

          <div className={pane === 'chat' ? 'joint-chat' : 'joint-chat is-hidden-mobile'}>
            <div className="thread" ref={threadRef}>
              <PrepSummary notes={engine.prepNotes} />
              <PerspectiveCard
                text={
                  topic.additionalPerspective?.trim() ||
                  '이 주제에는 별도로 정해 둔 추가 관점이 없습니다. 논의에서 남은 조건과 예외를 다시 점검해 보세요.'
                }
              />
              {messages.map((message, index) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  covered={settings.displayMode === 'real' && !engine.ended && message.speakerId !== 'user' && index !== lastAiIndex}
                  isLatestAi={index === lastAiIndex}
                />
              ))}
              <div className="thread-tail" aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MessageRow({
  message,
  covered,
  isLatestAi,
}: {
  message: Message
  covered: boolean
  isLatestAi: boolean
}) {
  const isUser = message.speakerId === 'user'
  if (isUser) {
    return (
      <div className="bubble user-bubble">
        <div className="bubble-body">
          <span className="bubble-name">나</span>
          <p className="bubble-text">{message.text}</p>
        </div>
      </div>
    )
  }
  if (covered) {
    return (
      <div className="covered-card">
        <span className="covered-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M2.8 12S6.5 5.8 12 5.8 21.2 12 21.2 12 17.5 18.2 12 18.2 2.8 12 2.8 12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <span>실전 모드 · 이전 발언은 가려져 있어요</span>
        <span className="covered-tail">종료 후 전체 공개</span>
      </div>
    )
  }
  return (
    <div className={`bubble ai-bubble ${personaClass[message.speakerId] ?? 'tone-blue'}${isLatestAi ? ' is-latest' : ''}`}>
      <span className="avatar">{nameOf(message.speakerId).slice(0, 1)}</span>
      <div className="bubble-body">
        <span className="bubble-name">{nameOf(message.speakerId)}</span>
        <p className="bubble-text">{message.text}</p>
        {message.source === 'mock' ? <span className="bubble-tag">데모</span> : null}
      </div>
    </div>
  )
}
