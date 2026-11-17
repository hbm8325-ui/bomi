import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeminiError, generateJson, listModels } from '../src/logic/gemini'
import { replySchema } from '../src/logic/prompts'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateContent 요청', () => {
  it('헤더·JSON 모드·응답 스키마를 함께 보낸다', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ candidates: [{ content: { parts: [{ text: '{"text":"그렇게 볼 수 있습니다."}' }] } }] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateJson<{ text: string }>({
      key: 'AIzaTESTKEY1234567890',
      model: 'gemini-2.5-flash',
      system: '시스템 지시',
      contents: { topic: '주제' },
      schema: replySchema,
      temperature: 0.4,
      maxOutputTokens: 512,
    })

    expect(result.text).toBe('그렇게 볼 수 있습니다.')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    )
    const headers = init.headers as Record<string, string>
    expect(headers['x-goog-api-key']).toBe('AIzaTESTKEY1234567890')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(String(init.body))
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toEqual(replySchema)
    expect(body.generationConfig.maxOutputTokens).toBe(512)
    expect(body.systemInstruction.parts[0].text).toBe('시스템 지시')
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual({ topic: '주제' })
  })

  it('429는 할당량 초과 안내로 바꾼다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }, 429)))
    await expect(
      generateJson({ key: 'k'.repeat(20), model: 'gemini-2.5-flash', system: '', contents: {}, schema: replySchema }),
    ).rejects.toMatchObject({ code: 'QUOTA' })
  })

  it('403은 차단 안내, 404는 모델 안내로 바꾼다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'Permission denied' } }, 403)))
    await expect(
      generateJson({ key: 'k'.repeat(20), model: 'gemini-2.5-flash', system: '', contents: {}, schema: replySchema }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'not found' } }, 404)))
    await expect(
      generateJson({ key: 'k'.repeat(20), model: 'gemini-9.9-flash', system: '', contents: {}, schema: replySchema }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('키의 API 오류(400)는 INVALID_KEY로 안내한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }, 400)))
    await expect(
      generateJson({ key: 'bad', model: 'gemini-2.5-flash', system: '', contents: {}, schema: replySchema }),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' })
  })

  it('네트워크 실패는 NETWORK로 안내한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    const error: unknown = await generateJson({
      key: 'k'.repeat(20),
      model: 'm',
      system: '',
      contents: {},
      schema: replySchema,
    }).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(GeminiError)
    expect((error as GeminiError).code).toBe('NETWORK')
  })

  it('빈 응답은 BAD_RESPONSE로 안내한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }] })))
    await expect(
      generateJson({ key: 'k'.repeat(20), model: 'm', system: '', contents: {}, schema: replySchema }),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' })
  })

  it('키가 없으면 요청하지 않는다', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(listModels('   ')).rejects.toMatchObject({ code: 'NO_KEY' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('모델 목록 요청', () => {
  it('x-goog-api-key 헤더로 models를 조회한다', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        models: [
          { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const models = await listModels('AIzaTESTKEY1234567890')
    expect(models[0].id).toBe('gemini-2.5-flash')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/v1beta/models?pageSize=200')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaTESTKEY1234567890')
  })
})
