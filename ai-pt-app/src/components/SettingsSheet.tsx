import type { Settings } from '../types'
import type { GeminiModel } from '../logic/gemini'
import { pickBestModel } from '../logic/gemini'
import { Sheet } from './Sheet'

export type SettingsStatus = {
  kind: 'idle' | 'loading' | 'ok' | 'error'
  message: string
}

type Props = {
  settings: Settings
  models: GeminiModel[]
  status: SettingsStatus
  onChangeKey: (key: string) => void
  onChangeModel: (id: string | null) => void
  onTest: () => void
  onClearKey: () => void
  onClose: () => void
}

export function SettingsSheet({
  settings,
  models,
  status,
  onChangeKey,
  onChangeModel,
  onTest,
  onClearKey,
  onClose,
}: Props) {
  const recommended = pickBestModel(models)
  return (
    <Sheet
      title="Gemini 연결 설정"
      subtitle="키는 이 PC의 브라우저에만 저장되고, 앱이 아니라 Google 서버로만 전송됩니다."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClearKey}>
            키 삭제
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            닫기
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="api-key">Gemini API 키 (AIza… 로 시작)</label>
        <div className="field-row">
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={settings.apiKey}
            placeholder="AIzaSy..."
            onChange={event => onChangeKey(event.target.value)}
          />
          <button type="button" className="btn btn-dark" onClick={onTest} disabled={status.kind === 'loading'}>
            {status.kind === 'loading' ? '확인 중…' : '연결 테스트'}
          </button>
        </div>
        <p className="hint">
          발급: <code>aistudio.google.com/apikey</code> → 구글 로그인 → Create API key → 복사해서 붙여넣기
        </p>
        {status.message ? (
          <p className={`status-line ${status.kind === 'ok' ? 'is-ok' : status.kind === 'error' ? 'is-error' : ''}`}>
            {status.message}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="model-select">사용할 모델</label>
        <select
          id="model-select"
          value={settings.model ?? ''}
          onChange={event => onChangeModel(event.target.value || null)}
          disabled={!models.length}
        >
          {!models.length ? <option value="">연결 테스트를 먼저 실행하세요</option> : null}
          {models.map(model => (
            <option key={model.id} value={model.id}>
              {model.displayName}
              {model.id === recommended ? ' (추천)' : ''}
            </option>
          ))}
        </select>
        <p className="hint">
          💡 무료 등급에서는 <strong>Flash-Lite 계열</strong>을 고르면 하루 요청 한도가 넉넉해 연습 중 끊기지 않습니다.
          채점은 한 번에 1회, 채팅은 질문당 1회로 호출됩니다.
        </p>
      </div>

      <div className="field">
        <label>연습 코치</label>
        <p className="hint">
          채팅 상단의 토글로 켜고 끕니다(현재 {settings.coachOn ? 'ON' : 'OFF'}). 켜 두면 "보고서 다 써줘"처럼 넓은 요청에
          팁이 붙어 프롬프트 습관을 바로 고칠 수 있습니다.
        </p>
      </div>

      <div className="notice-box">
        <strong>키 없이도 연습할 수 있습니다.</strong> 데모 모드에서는 키워드·질문 범위에 따라 시험장과 비슷한 응답과 로컬 채점이
        동작합니다. 실제 Gemini를 연결하면 자료 원문을 읽고 계산·비교하는 응답과 문장 단위 채점이 가능합니다.
      </div>
    </Sheet>
  )
}
