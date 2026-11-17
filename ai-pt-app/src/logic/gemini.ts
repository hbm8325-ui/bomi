export const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const KEY_STORAGE = 'aipt_gemini_api_key'
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
    if (!lower.startsWith('gemini')) continue
    if (/(embedding|embed|imagen|tts|audio|aqa|live|native|vision)/.test(lower)) continue
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

/** 기본 추천: 최신 Flash-Lite(무료 한도가 넉넉) → 없으면 최신 Flash → 마지막으로 Pro. */
export function pickBestModel(models: readonly GeminiModel[]): string | null {
  if (!models.length) return null
  const score = (m: GeminiModel) => m.version * 100 + (m.isLite ? 30 : 0) + (m.isFlash ? 20 : 0) + (m.isPro ? 3 : 0)
  return [...models].sort((a, b) => score(b) - score(a))[0].id
}

export function modelLabel(models: readonly GeminiModel[], id: string | null): string {
  if (!id) return '모델 미선택'
  const found = models.find(m => m.id === id)
  return found?.displayName && found.displayName !== id ? found.displayName : id
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
    return new GeminiError('FORBIDDEN', '이 키로는 요청이 차단되었습니다(403). 키 제한이나 결제 설정을 확인해 주세요.', status)
  }
  if (status === 404) {
    return new GeminiError('NOT_FOUND', '선택한 모델을 찾을 수 없습니다. 설정에서 모델을 다시 불러와 주세요.', status)
  }
  if (status === 429) {
    return new GeminiError(
      'QUOTA',
      '무료 할당량을 모두 썼거나 요청이 몰렸습니다(429). 1분 뒤 다시 시도하거나 Flash-Lite 모델로 바꿔 보세요.',
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

/** GET /v1beta/models — 키 확인과 사용 가능한 모델 목록을 함께 가져옵니다. */
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

type Part = { text: string }
export type Turn = { role: 'user' | 'model'; parts: Part[] }

type GenerateOptions = {
  key: string
  model: string
  system: string
  contents: Turn[]
  temperature?: number
  maxOutputTokens?: number
  signal?: AbortSignal
}

function buildBody(options: GenerateOptions, extra?: Record<string, unknown>) {
  const { system, contents, temperature = 0.8, maxOutputTokens = 2048 } = options
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature, maxOutputTokens, ...(extra ?? {}) },
    safetySettings: [
      'HARM_CATEGORY_HARASSMENT',
      'HARM_CATEGORY_HATE_SPEECH',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      'HARM_CATEGORY_DANGEROUS_CONTENT',
    ].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
  }
}

async function postGenerate(options: GenerateOptions, body: Record<string, unknown>) {
  const { key, model, signal } = options
  const trimmed = key.trim()
  if (!trimmed) throw new GeminiError('NO_KEY', 'Gemini API 키를 먼저 입력해 주세요.')
  if (!model) throw new GeminiError('NOT_FOUND', '사용할 모델이 정해지지 않았습니다. 설정에서 모델을 불러와 주세요.')
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
    throw new GeminiError('BAD_REQUEST', '안전 필터가 이 요청을 막았습니다. 표현을 조금 바꿔 다시 시도해 주세요.')
  }
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts ?? []).map(part => part?.text ?? '').join('').trim()
  if (!text) {
    const reason = candidate?.finishReason
    throw new GeminiError(
      'BAD_RESPONSE',
      reason === 'MAX_TOKENS' ? '응답이 최대 길이에서 잘렸습니다. 다시 시도해 주세요.' : 'Gemini가 빈 응답을 돌려줬습니다. 다시 시도해 주세요.',
    )
  }
  return text
}

/** 일반 텍스트 응답(채팅·코칭) */
export async function generateText(options: GenerateOptions): Promise<string> {
  return postGenerate(options, buildBody(options))
}

/** JSON 스키마 강제 응답(채점·과제 생성) */
export async function generateJson<T>(options: GenerateOptions & { schema: JsonSchema }): Promise<T> {
  const { schema } = options
  const body = buildBody(options, {
    responseMimeType: 'application/json',
    responseSchema: schema,
  })
  const text = await postGenerate(options, body)
  return parseJsonLoose<T>(text)
}

/** ```json 펜스나 앞뒤 설명이 섞여도 첫 JSON 값을 꺼내 파싱합니다. */
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim()
  const attempt = (value: string): T | null => {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }
  const direct = attempt(cleaned)
  if (direct !== null) return direct
  const firstObj = cleaned.indexOf('{')
  const lastObj = cleaned.lastIndexOf('}')
  if (firstObj >= 0 && lastObj > firstObj) {
    const parsed = attempt(cleaned.slice(firstObj, lastObj + 1))
    if (parsed !== null) return parsed
  }
  const firstArr = cleaned.indexOf('[')
  const lastArr = cleaned.lastIndexOf(']')
  if (firstArr >= 0 && lastArr > firstArr) {
    const parsed = attempt(cleaned.slice(firstArr, lastArr + 1))
    if (parsed !== null) return parsed
  }
  throw new GeminiError('BAD_RESPONSE', 'Gemini 응답을 JSON으로 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
}

export function errorMessage(error: unknown): string {
  if (error instanceof GeminiError) return error.message
  if (error instanceof Error) return error.message
  return '알 수 없는 오류가 발생했습니다.'
}

export function errorCode(error: unknown): GeminiErrorCode {
  return error instanceof GeminiError ? error.code : 'UNKNOWN'
}
