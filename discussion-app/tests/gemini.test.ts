import { describe, expect, it } from 'vitest'
import { GeminiError, normalizeModels, parseJsonLoose, pickBestModel, type GeminiModel } from '../src/logic/gemini'

const raw = {
  models: [
    { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
    { name: 'models/gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/text-embedding-004', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-embedding-001', displayName: 'Gemini Embedding', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/imagen-3.0', displayName: 'Imagen', supportedGenerationMethods: ['predict'] },
    { name: 'models/gemini-2.5-flash-preview-tts', displayName: 'TTS', supportedGenerationMethods: ['generateContent'] },
  ],
}

describe('Gemini 모델 목록', () => {
  it('generateContent가 가능한 Gemini 텍스트 모델만 남긴다', () => {
    const models = normalizeModels(raw)
    const ids = models.map(model => model.id)
    expect(ids).toContain('gemini-2.5-flash')
    expect(ids).toContain('gemini-3.8-flash')
    expect(ids).not.toContain('text-embedding-004')
    expect(ids).not.toContain('gemini-embedding-001')
    expect(ids).not.toContain('imagen-3.0')
    expect(ids).not.toContain('gemini-2.5-flash-preview-tts')
  })

  it('버전이 더 높은 Flash를 lite보다 먼저 고른다', () => {
    expect(pickBestModel(normalizeModels(raw))).toBe('gemini-3.8-flash')
  })

  it('같은 버전이면 무료 한도가 넉넉한 Flash-Lite를 고른다', () => {
    const models: GeminiModel[] = normalizeModels({
      models: [
        { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
      ],
    })
    expect(pickBestModel(models)).toBe('gemini-2.5-flash-lite')
  })

  it('모델이 없으면 null을 돌려준다', () => {
    expect(normalizeModels({})).toEqual([])
    expect(pickBestModel([])).toBeNull()
    expect(normalizeModels(null)).toEqual([])
  })
})

describe('Gemini JSON 응답 파서', () => {
  it('평범한 JSON을 읽는다', () => {
    expect(parseJsonLoose<{ text: string }>('{"text":"안녕하세요"}')).toEqual({ text: '안녕하세요' })
  })

  it('```json 펜스를 벗겨낸다', () => {
    expect(parseJsonLoose<{ text: string }>('```json\n{"text":"좋습니다"}\n```')).toEqual({ text: '좋습니다' })
  })

  it('앞뒤에 설명이 붙어도 첫 JSON 객체를 꺼낸다', () => {
    const value = parseJsonLoose<{ text: string }>('응답입니다.\n{"text":"그렇게 볼 수 있습니다."}\n이상입니다.')
    expect(value.text).toBe('그렇게 볼 수 있습니다.')
  })

  it('중첩된 객체도 온전히 읽는다', () => {
    const value = parseJsonLoose<{ a: { b: number } }>('{"a":{"b":1}}')
    expect(value.a.b).toBe(1)
  })

  it('JSON이 아니면 BAD_RESPONSE 오류를 던진다', () => {
    try {
      parseJsonLoose('죄송합니다. 답을 만들 수 없습니다.')
      throw new Error('오류가 나야 합니다')
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiError)
      expect((error as GeminiError).code).toBe('BAD_RESPONSE')
    }
  })
})
