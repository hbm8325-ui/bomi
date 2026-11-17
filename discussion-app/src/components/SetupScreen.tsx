import { practiceTopics } from '../data/topics'
import type { DebateMode, DebateTopic, DiscussionStyle, DisplayMode, Pace, Settings } from '../types'
import { paceLabel } from '../logic/storage'
import { modelLabel, type GeminiModel } from '../logic/gemini'
import { stageList } from '../logic/stages'

export const categories = [...new Set(practiceTopics.map(topic => topic.category))]

export function SetupScreen({
  topic,
  settings,
  apiKey,
  models,
  onRandom,
  onOpenTopic,
  onOpenCustom,
  onOpenSettings,
  onOpenHistory,
  onOpenGuide,
  onChange,
  onStart,
}: {
  topic: DebateTopic | null
  settings: Settings
  apiKey: string
  models: GeminiModel[]
  onRandom: () => void
  onOpenTopic: () => void
  onOpenCustom: () => void
  onOpenSettings: () => void
  onOpenHistory: () => void
  onOpenGuide: () => void
  onChange: (patch: Partial<Settings>) => void
  onStart: () => void
}) {
  const connected = !!apiKey.trim()
  return (
    <div className="screen setup-screen">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                d="M4 5.5h6.2c.9 0 1.8.5 1.8 1.4V19c0-.9-.9-1.4-1.8-1.4H4zM20 5.5h-6.2c-.9 0-1.8.5-1.8 1.4V19c0-.9.9-1.4 1.8-1.4H20z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>토의 연습실</span>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={onOpenHistory}>
            기록
          </button>
          <button className="ghost-button" onClick={onOpenSettings}>
            설정
          </button>
        </div>
      </header>

      <div className="setup-scroll">
        <section className="hero">
          <p className="eyebrow">인문학 그룹 토의 · 4단계 · 비공식 연습</p>
          <h1>
            세 명의 팀원과
            <br />
            합의안을 만들어 보세요
          </h1>
          <p className="hero-sub">
            찬반 토론이 아닙니다. 정답 없는 주제를 두고 원칙·사람·실행의 관점을 조율해 40분 안에 공동 결과물을
            완성하는 그룹 토의를 연습합니다.
          </p>
          <ol className="stage-preview">
            {stageList.map(item => (
              <li key={item.id}>
                <span className="stage-preview-num">{item.number}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.minutes}분</small>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <button className={connected ? 'status-card is-on' : 'status-card'} onClick={onOpenSettings}>
          <span className={connected ? 'status-dot is-on' : 'status-dot'} aria-hidden="true" />
          <span className="status-copy">
            <strong>{connected ? 'Gemini 연결됨' : '데모 모드로 체험 중'}</strong>
            <small>
              {connected
                ? `${modelLabel(models, settings.model)} · 내 키는 이 브라우저에만 저장됩니다`
                : 'API 키 없이도 4단계 흐름과 예시 토의를 확인할 수 있어요'}
            </small>
          </span>
          <span className="status-arrow" aria-hidden="true">
            ›
          </span>
        </button>

        <section className="card topic-card">
          <div className="card-head">
            <h2>오늘의 토의 주제</h2>
            {topic ? <span className="chip chip-soft">{topic.category}</span> : null}
          </div>
          {topic ? (
            <>
              <p className="topic-title">{topic.title}</p>
              {topic.context?.situation ? <p className="topic-situation">{topic.context.situation}</p> : null}
              {topic.context?.keyIssue ? (
                <p className="topic-issue">
                  <span>쟁점</span>
                  {topic.context.keyIssue}
                </p>
              ) : null}
              {topic.additionalPerspective ? (
                <p className="topic-locked-note">
                  <span aria-hidden="true">💡</span>
                  3단계에서 이 주제의 추가 관점이 공개됩니다. 모범 토의에서 미리 볼 수 있어요.
                </p>
              ) : null}
            </>
          ) : (
            <p className="topic-empty">주제를 고르면 세 명의 팀원과 4단계 토의를 시작합니다.</p>
          )}
          <div className="topic-actions">
            <button className="soft-button" onClick={onRandom}>
              랜덤 주제
            </button>
            <button className="soft-button" onClick={onOpenTopic}>
              목록에서 선택
            </button>
            <button className="soft-button" onClick={onOpenCustom}>
              직접 입력
            </button>
          </div>
          {topic ? (
            <button className="ghost-button full guide-open" onClick={onOpenGuide}>
              📖 모범 토의 & 결과물 보기
            </button>
          ) : null}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>토의 설정</h2>
          </div>
          <div className="settings-list">
            <SettingRow
              label="토의 성향"
              hint={settings.discussionStyle === 'consensus' ? '관점을 조율해 합의안을 만듭니다' : '결론 차이를 더 적극적으로 검토합니다'}
              value={settings.discussionStyle}
              options={[
                { value: 'consensus', label: '합의·조율' },
                { value: 'debate', label: '찬반 집중' },
              ]}
              onChange={value => onChange({ discussionStyle: value as DiscussionStyle })}
            />
            <SettingRow
              label="팀원 응답 수"
              hint={settings.debateMode === 'deep' ? '내 발언마다 두 명이 답합니다' : '내 발언마다 한 명이 답합니다'}
              value={settings.debateMode}
              options={[
                { value: 'basic', label: '1명' },
                { value: 'deep', label: '2명' },
              ]}
              onChange={value => onChange({ debateMode: value as DebateMode })}
            />
            <SettingRow
              label="표시 모드"
              hint={settings.displayMode === 'real' ? '이전 AI 발언을 가립니다' : '모든 발언이 보입니다'}
              value={settings.displayMode}
              options={[
                { value: 'normal', label: '일반 모드' },
                { value: 'real', label: '실전 모드' },
              ]}
              onChange={value => onChange({ displayMode: value as DisplayMode })}
            />
            <SettingRow
              label="AI 응답 간격"
              hint={`현재 ${paceLabel(settings.pace)}`}
              value={settings.pace}
              options={[
                { value: 'relaxed', label: '여유' },
                { value: 'normal', label: '보통' },
                { value: 'fast', label: '빠름' },
              ]}
              onChange={value => onChange({ pace: value as Pace })}
            />
            <SettingRow
              label="AI 목소리"
              hint={settings.tts ? '발언을 음성으로 읽어 줍니다' : '글자로만 봅니다'}
              value={settings.tts ? 'on' : 'off'}
              options={[
                { value: 'off', label: '끔' },
                { value: 'on', label: '재생' },
              ]}
              onChange={value => onChange({ tts: value === 'on' })}
            />
          </div>
        </section>

        <p className="fine-print">
          SK하이닉스 비공식 연습 웹앱입니다. 실제 면접 주제·평가와 무관하며, 발언과 피드백은 AI가 만든 연습 결과입니다.
          주제는 4단계 그룹 토의 연습을 위해 새로 만든 것입니다.
        </p>
      </div>

      <div className="cta-bar">
        <button className="primary-button" disabled={!topic} onClick={onStart}>
          {topic ? '4단계 토의 시작하기' : '주제를 먼저 골라 주세요'}
        </button>
      </div>
    </div>
  )
}

function SettingRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string
  hint: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <span className="setting-label">{label}</span>
        <span className="setting-hint">{hint}</span>
      </div>
      <div className="mini-segment" role="radiogroup" aria-label={label}>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? 'mini-item is-on' : 'mini-item'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
