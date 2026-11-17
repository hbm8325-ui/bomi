import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeminiError, generateJson, generateText, listModels } from '../src/logic/gemini'

type Captured = { url: string; init: RequestInit }

function stubFetch(payload: unknown, status = 200): Captured[] {
  const calls: Captured[] = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Gemini HTTP 요청 구성', () => {
  it('모델 목록을 x-goog-api-key 헤더로 조회한다', async () => {
    const calls = stubFetch({
      models: [{ name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] }],
    })
    const models = await listModels('AIza-test-key')
    expect(models[0].id).toBe('gemini-2.5-flash-lite')
    expect(calls[0].url).toContain('/v1beta/models?pageSize=200')
    expect((calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIza-test-key')
  })

  it('채팅 요청에 시스템 프롬프트와 대화 이력이 들어간다', async () => {
    const calls = stubFetch({
      candidates: [{ content: { parts: [{ text: '자료 2 기준으로 0.32 m/s입니다.' }] } }],
    })
    const reply = await generateText({
      key: 'AIza-test-key',
      model: 'gemini-2.5-flash-lite',
      system: '너는 AI Agent다.',
      contents: [{ role: 'user', parts: [{ text: '제어풍속 알려줘' }] }],
    })
    expect(reply).toBe('자료 2 기준으로 0.32 m/s입니다.')
    const body = JSON.parse(String(calls[0].init.body)) as {
      systemInstruction: { parts: { text: string }[] }
      contents: { role: string; parts: { text: string }[] }[]
      generationConfig: { responseMimeType?: string }
    }
    expect(body.systemInstruction.parts[0].text).toBe('너는 AI Agent다.')
    expect(body.contents[0].role).toBe('user')
    expect(body.generationConfig.responseMimeType).toBeUndefined()
  })

  it('채점 요청은 JSON 스키마를 강제하고 응답을 파싱한다', async () => {
    const calls = stubFetch({
      candidates: [{ content: { parts: [{ text: '```json\n{"total": 81}\n```' }] } }],
    })
    const result = await generateJson<{ total: number }>({
      key: 'AIza-test-key',
      model: 'gemini-2.5-flash-lite',
      system: '채점하라',
      contents: [{ role: 'user', parts: [{ text: '답안' }] }],
      schema: { type: 'OBJECT', properties: { total: { type: 'NUMBER' } } },
    })
    expect(result.total).toBe(81)
    const body = JSON.parse(String(calls[0].init.body)) as {
      generationConfig: { responseMimeType: string; responseSchema: { type: string } }
    }
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT')
  })

  it('429는 무료 한도 오류로 매핑된다', async () => {
    stubFetch({ error: { message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }, 429)
    await expect(
      generateText({ key: 'AIza-test-key', model: 'gemini-2.5-flash-lite', system: 's', contents: [] }),
    ).rejects.toMatchObject({ code: 'QUOTA' })
  })

  it('400 잘못된 키는 INVALID_KEY로 매핑된다', async () => {
    stubFetch({ error: { message: 'API key not valid', status: 'INVALID_ARGUMENT' } }, 400)
    try {
      await listModels('AIza-bad')
      throw new Error('should not reach')
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiError)
      expect((error as GeminiError).code).toBe('INVALID_KEY')
    }
  })

  it('키가 비어 있으면 네트워크를 부르지 않는다', async () => {
    const calls = stubFetch({})
    await expect(listModels('  ')).rejects.toMatchObject({ code: 'NO_KEY' })
    expect(calls).toHaveLength(0)
  })

  it('네트워크 실패는 NETWORK 오류로 안내한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    await expect(
      generateText({ key: 'AIza-test-key', model: 'gemini-2.5-flash-lite', system: 's', contents: [] }),
    ).rejects.toMatchObject({ code: 'NETWORK' })
  })

  it('빈 응답은 BAD_RESPONSE로 알린다', async () => {
    stubFetch({ candidates: [{ content: { parts: [] } }] })
    await expect(
      generateText({ key: 'AIza-test-key', model: 'gemini-2.5-flash-lite', system: 's', contents: [] }),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' })
  })
})
