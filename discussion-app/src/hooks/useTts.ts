import { useEffect, useRef, useState } from 'react'
import type { AIId, Message } from '../types'

const tone: Record<AIId, { pitch: number; rate: number }> = {
  ai1: { pitch: 0.92, rate: 0.98 },
  ai2: { pitch: 1.14, rate: 1.04 },
  ai3: { pitch: 1.0, rate: 0.92 },
}

/**
 * AI 발언을 브라우저 음성 합성으로 읽어 줍니다.
 * 지원하지 않는 환경에서는 조용히 꺼진 채로 동작합니다(안전 폴백).
 */
export function useTts(options: {
  enabled: boolean
  messages: readonly Message[]
  paused: boolean
}): { supported: boolean; speaking: boolean } {
  const { enabled, messages, paused } = options
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const spokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSupported('speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function')
  }, [])

  useEffect(() => {
    if (!supported) return
    if (!enabled || paused) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const lastAi = [...messages].reverse().find(m => m.speakerId !== 'user')
    if (!lastAi) return
    if (spokenRef.current === lastAi.id) return
    // 새로 도착한 발언만 읽습니다(기록을 다시 열었을 때 과거 발언을 읽지 않도록).
    if (Date.now() - lastAi.timestamp > 20000) return
    const voice = tone[lastAi.speakerId as AIId] ?? tone.ai1
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(lastAi.text)
      utterance.lang = 'ko-KR'
      utterance.pitch = voice.pitch
      utterance.rate = voice.rate
      const korean = window.speechSynthesis.getVoices().find(item => item.lang?.startsWith('ko'))
      if (korean) utterance.voice = korean
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      spokenRef.current = lastAi.id
      window.speechSynthesis.speak(utterance)
    } catch {
      setSpeaking(false)
    }
  }, [enabled, messages, paused, supported])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  return { supported, speaking }
}
