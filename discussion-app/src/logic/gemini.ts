export const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const KEY_STORAGE = 'hd_gemini_api_key'
export const KEY_HINT = /^AIza[0-9A-Za-z_\-.]{20,}$/

export type GeminiModel = {
  id: string
  displayName: string
  description?: string
  methods: string[]
  isFlash: boolean
  isLite: boolean
  isPro: boolean
  version: number
}

export type GeminiErrorCode =
  | 'NO_KEY'
  | 'INVALID_KEY'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'QUOTA'
  | 'OVERLOADED'
  | 'NETWORK'
  | 'BAD_REQUEST'
  | 'BAD_RESPONSE'
  | 'ABORTED'
  | 'UNKNOWN'

export class GeminiError extends Error {
  code: GeminiErrorCode
  status?: number
  constructor(code: GeminiErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'GeminiError'
    this.code = code
    this.status = status
  }
}

const versionOf = (id: string): number => {
  const match = id.match(/gemini-(\d+)(?:\.(\d+))?/i)
  if (!match) return 0
  return Number(match[1]) + Number(match[2] ?? 0) / 100
}

type RawModel = {
  name?: string
  displayName?: string
  description?: string
  supportedGenerationMethods?: string[]
}

export function normalizeModels(raw: unknown): GeminiModel[] {
  const list = (raw as { models?: RawModel[] } | null)?.models
  if (!Array.isArray(list)) return []
  const models: GeminiModel[] = []
  for (const item of list) {
    const full = typeof item?.name === 'string' ? item.name : ''
    const id = full.replace(/^models\//, '')
    if (!id) continue
    const methods = Array.isArray(item.supportedGenerationMethods) ? item.supportedGenerationMethods : []
    if (!methods.includes('generateContent')) continue
    const lower = id.toLowerCase()
    // 텍스트 생성용 Gemini 계열만 남깁니다(임베딩·이미지·TTS·AQA·Gemma 제외).
    if (!lower.startsWith('gemini')) continue
    if (/(embedding|embed|imagen|tts|audio|aqa|live|native)/.test(lower)) continue
    models.push({
      id,
      displayName: item.displayName || id,
      description: item.description,
      methods,
      isFlash: /flash/.test(lower),
      isLite: /lite/.test(lower),
      isPro: /pro/.test(lower),
      version: versionOf(lower),
    })
  }
  return models
}

/**
 * 사용 가능한 모델 중 가장 좋은 Flash-Lite 계열을 고릅니다.
 * 토의 40분 동안 발언 요청이 자주 나가므로, 무료 한도가 넉넉한 최신 Flash-Lite를 우선합니다.
 * (같은 버전 안에서 lite > 일반 flash > pro 순)
 */
export function pickBestModel(models: readonly GeminiModel[]): string | null {
  if (!models.length) return null
  const score = (m: GeminiModel) =>
    m.version * 100 + (m.isLite ? 30 : 0) + (m.isFlash ? 12 : 0) - (m.isPro ? 10 : 0)
  return [...models].sort((a, b) => score(b) - score(a))[0].id
}

export function modelLabel(models: readonly GeminiModel[], id: string | null): string {
  if (!id) return '모델 미선택'
  const found = models.find(m => m.id === id)
  return found?.displayName && found.displayName !== id ? `${found.displayName}` : id
}

async function readError(res: Response): Promise<{ message: string; status?: string }> {
  try {
    const data = (await res.json()) as { error?: { message?: string; status?: string } }
    return { message: data?.error?.message ?? '', status: data?.error?.status }
  } catch {
    return { message: '' }
  }
}

function mapError(status: number, message: string, apiStatus?: string): GeminiError {
  if (status === 400) {
    if (/api key|API_KEY|key not valid/i.test(message) || apiStatus === 'INVALID_ARGUMENT') {
      return new GeminiError('INVALID_KEY', 'API 키가 올바르지 않거나 이 모델에 쓸 수 없습니다.', status)
    }
    return new GeminiError('BAD_REQUEST', message || '요청 형식이 올바르지 않습니다(400).', status)
  }
  if (status === 401) return new GeminiError('INVALID_KEY', 'API 키가 인증되지 않았습니다(401).', status)
  if (status === 403) {
    return new GeminiError(
      'FORBIDDEN',
      '이 키로는 요청이 차단되었습니다(403). 키 제한이나 결제 설정을 확인해 주세요.',
      status,
    )
  }
  if (status === 404) {
    return new GeminiError('NOT_FOUND', '선택한 모델을 찾을 수 없습니다. 설정에서 모델을 다시 불러와 주세요.', status)
  }
  if (status === 429) {
    return new GeminiError(
      'QUOTA',
      '무료 할당량을 모두 썼거나 요청이 몰렸습니다(429). 1분 뒤 다시 시도하거나 다른 모델을 선택해 주세요.',
      status,
    )
  }
  if (status >= 500) {
    return new GeminiError('OVERLOADED', 'Gemini 서버가 잠시 혼잡합니다(5xx). 잠시 뒤 다시 시도해 주세요.', status)
  }
  return new GeminiError('UNKNOWN', message || `요청이 실패했습니다(${status}).`, status)
}

async function call(url: string, key: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal,
      headers: { 'x-goog-api-key': key, ...(init.headers as Record<string, string> | undefined) },
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new GeminiError('ABORTED', '요청을 취소했습니다.')
    }
    throw new GeminiError(
      'NETWORK',
      'Gemini에 연결하지 못했습니다. 네트워크와 브라우저 차단(광고 차단 확장 프로그램 등)을 확인해 주세요.',
    )
  }
}

/** GET /v1beta/models — 키 확인과 사용 가능한 generateContent 모델 목록을 함께 가져옵니다. */
export async function listModels(key: string, signal?: AbortSignal): Promise<GeminiModel[]> {
  const trimmed = key.trim()
  if (!trimmed) throw new GeminiError('NO_KEY', 'Gemini API 키를 먼저 입력해 주세요.')
  const res = await call(`${API_BASE}/models?pageSize=200`, trimmed, { method: 'GET' }, signal)
  if (!res.ok) {
    const { message, status } = await readError(res)
    throw mapError(res.status, message, status)
  }
  const models = normalizeModels(await res.json())
  if (!models.length) {
    throw new GeminiError(
      'NOT_FOUND',
      '이 키로 사용할 수 있는 Gemini 텍스트 생성 모델이 없습니다. AI Studio에서 키와 API 사용 설정을 확인해 주세요.',
    )
  }
  return models
}

type JsonSchema = Record<string, unknown>

export async function generateJson<T>(options: {
  key: string
  model: string
  system: string
  contents: unknown
  schema: JsonSchema
  temperature?: number
  maxOutputTokens?: number
  signal?: AbortSignal
}): Promise<T> {
  const { key, model, system, contents, schema, temperature = 1, maxOutputTokens = 2048, signal } = options
  const trimmed = key.trim()
  if (!trimmed) throw new GeminiError('NO_KEY', 'Gemini API 키를 먼저 입력해 주세요.')
  if (!model) throw new GeminiError('NOT_FOUND', '사용할 모델이 정해지지 않았습니다. 설정에서 모델을 불러와 주세요.')
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(contents) }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
    safetySettings: [
      'HARM_CATEGORY_HARASSMENT',
      'HARM_CATEGORY_HATE_SPEECH',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      'HARM_CATEGORY_DANGEROUS_CONTENT',
    ].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
  }
  const res = await call(
    `${API_BASE}/models/${encodeURIComponent(model)}:generateContent`,
    trimmed,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    signal,
  )
  if (!res.ok) {
    const { message, status } = await readError(res)
    throw mapError(res.status, message, status)
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
    promptFeedback?: { blockReason?: string }
  }
  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(
      'BAD_REQUEST',
      '안전 필터가 이 주제의 요청을 막았습니다. 표현을 조금 바꾸거나 다른 주제로 시도해 주세요.',
    )
  }
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts ?? []).map(part => part?.text ?? '').join('').trim()
  if (!text) {
    const reason = candidate?.finishReason
    throw new GeminiError(
      'BAD_RESPONSE',
      reason === 'MAX_TOKENS'
        ? '응답이 최대 길이에서 잘렸습니다. 다시 시도해 주세요.'
        : 'Gemini가 빈 응답을 돌려줬습니다. 다시 시도해 주세요.',
    )
  }
  return parseJsonLoose<T>(text)
}

/** ```json 펜스나 앞뒤 설명이 섞여도 첫 JSON 객체를 꺼내 파싱합니다. */
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T
      } catch {
        /* fall through */
      }
    }
    throw new GeminiError('BAD_RESPONSE', 'Gemini 응답을 JSON으로 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof GeminiError) return error.message
  if (error instanceof Error) return error.message
  return '알 수 없는 오류가 발생했습니다.'
}

export function errorCode(error: unknown): GeminiErrorCode {
  return error instanceof GeminiError ? error.code : 'UNKNOWN'
}
