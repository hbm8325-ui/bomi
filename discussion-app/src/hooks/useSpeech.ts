import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechAlternative = { transcript: string; confidence: number }
type SpeechResult = { isFinal: boolean; length: number; 0: SpeechAlternative }
type SpeechResultList = { length: number; item: (index: number) => SpeechResult; [index: number]: SpeechResult }
type SpeechEvent = { resultIndex: number; results: SpeechResultList }
type SpeechErrorEvent = { error: string; message?: string }

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

const getCtor = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === 'undefined') return null
  const w = window as SpeechWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
}

export type SpeechState = {
  supported: boolean
  listening: boolean
  finalText: string
  interim: string
  text: string
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

/** iPhone Safari(webkitSpeechRecognition)와 데스크톱 Chrome을 함께 다루는 한국어 음성 입력 훅. */
export function useSpeech(lang = 'ko-KR'): SpeechState {
  const ctorRef = useRef<{ new (): SpeechRecognitionLike } | null>(null)
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [finalText, setFinalText] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const wantRef = useRef(false)
  const finalRef = useRef('')
  const restartTimer = useRef<number | null>(null)
  const failedRef = useRef(false)

  useEffect(() => {
    ctorRef.current = getCtor()
    setSupported(!!getCtor())
    return () => {
      wantRef.current = false
      if (restartTimer.current) window.clearTimeout(restartTimer.current)
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const build = useCallback(() => {
    const Ctor = ctorRef.current
    if (!Ctor) return null
    const recognition = new Ctor()
    recognition.lang = lang
    recognition.interimResults = true
    recognition.continuous = !isIOS()
    recognition.maxAlternatives = 1
    recognition.onstart = () => {
      failedRef.current = false
      setListening(true)
    }
    recognition.onresult = (event: SpeechEvent) => {
      let fresh = ''
      let pending = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const chunk = result[0]?.transcript ?? ''
        if (result.isFinal) fresh += chunk
        else pending += chunk
      }
      if (fresh) {
        finalRef.current = `${finalRef.current} ${fresh}`.replace(/\s+/g, ' ').trim()
        setFinalText(finalRef.current)
      }
      setInterim(pending.trim())
    }
    recognition.onerror = (event: SpeechErrorEvent) => {
      if (event.error === 'aborted') return
      if (event.error === 'no-speech') {
        setError('소리가 들리지 않았어요. 다시 말씀해 주세요.')
        return
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        failedRef.current = true
        wantRef.current = false
        setListening(false)
        setError('마이크 권한이 필요해요. 아래 입력창에 직접 적어 주세요.')
        return
      }
      if (event.error === 'network') {
        setError('음성 인식 연결이 불안정해요. 잠시 뒤 다시 시도하거나 직접 입력해 주세요.')
        return
      }
      setError('음성 인식을 시작하지 못했어요. 직접 입력을 사용해 주세요.')
    }
    recognition.onend = () => {
      setInterim('')
      if (wantRef.current && !failedRef.current) {
        // iOS Safari는 한 구간이 끝나면 스스로 멈추므로, 사용자가 멈추기 전까지 다시 시작합니다.
        restartTimer.current = window.setTimeout(() => {
          try {
            recognition.start()
          } catch {
            setListening(false)
          }
        }, 200)
        return
      }
      setListening(false)
    }
    return recognition
  }, [lang])

  const start = useCallback(() => {
    if (!ctorRef.current) {
      setSupported(false)
      setError('이 브라우저는 음성 인식을 지원하지 않아요. 아래 입력창에 직접 적어 주세요.')
      return
    }
    setError(null)
    finalRef.current = ''
    failedRef.current = false
    setFinalText('')
    setInterim('')
    wantRef.current = true
    if (!recognitionRef.current) recognitionRef.current = build()
    try {
      recognitionRef.current?.start()
      setListening(true)
    } catch {
      // 이미 시작된 인식기는 stop 후 다시 시작합니다.
      try {
        recognitionRef.current?.stop()
        window.setTimeout(() => recognitionRef.current?.start(), 150)
        setListening(true)
      } catch {
        setError('음성 인식을 시작하지 못했어요. 직접 입력을 사용해 주세요.')
        setListening(false)
      }
    }
  }, [build])

  const stop = useCallback(() => {
    wantRef.current = false
    if (restartTimer.current) {
      window.clearTimeout(restartTimer.current)
      restartTimer.current = null
    }
    try {
      recognitionRef.current?.stop()
    } catch {
      /* 인식기가 이미 멈춘 경우 */
    }
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    finalRef.current = ''
    setFinalText('')
    setInterim('')
    setError(null)
  }, [])

  const text = `${finalText} ${interim}`.replace(/\s+/g, ' ').trim()

  return { supported, listening, finalText, interim, text, error, start, stop, reset }
}
