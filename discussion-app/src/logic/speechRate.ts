/**
 * 한국어 발화 속도 추정 — 분당 약 300자(초당 5음절) 기준.
 * 4단계 그룹 토의에서 1분 발언 길이를 감각적으로 맞추기 위한 안내입니다.
 */
export const CHARS_PER_MINUTE = 300

export type SpeechEstimate = {
  chars: number
  seconds: number
  label: string
  tone: 'short' | 'good' | 'long' | 'over'
}

const formatSeconds = (seconds: number): string => {
  if (seconds < 60) return `약 ${seconds}초`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}분 ${rest}초` : `${minutes}분`
}

export function estimateSpeech(text: string): SpeechEstimate {
  const chars = text.replace(/\s+/g, ' ').trim().length
  const seconds = Math.max(0, Math.round((chars / CHARS_PER_MINUTE) * 60))
  if (chars === 0) return { chars, seconds: 0, label: '', tone: 'short' }
  if (seconds < 20) {
    return { chars, seconds, label: `${formatSeconds(seconds)} 분량 · 조금 더 말해도 좋아요`, tone: 'short' }
  }
  if (seconds <= 45) {
    return { chars, seconds, label: `${formatSeconds(seconds)} 분량 · 적당해요`, tone: 'good' }
  }
  if (seconds <= 60) {
    return { chars, seconds, label: `${formatSeconds(seconds)} 분량 · 조금 길어요`, tone: 'long' }
  }
  return { chars, seconds, label: `${formatSeconds(seconds)} 분량 · 조금 줄이면 더 또렷해요`, tone: 'over' }
}
