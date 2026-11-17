import { describe, expect, it } from 'vitest'
import {
  GeminiError,
  modelLabel,
  normalizeModels,
  parseJsonLoose,
  pickBestModel,
} from '../src/logic/gemini'

const rawModels = {
  models: [
    {
      name: 'models/gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
    },
    {
      name: 'models/gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      supportedGenerationMethods: ['generateContent'],
    },
    {
      name: 'models/gemini-2.5-flash-lite',
      displayName: 'Gemini 2.5 Flash-Lite',
      supportedGenerationMethods: ['generateContent'],
    },
    {
      name: 'models/gemini-embedding-001',
      displayName: 'Embedding',
      supportedGenerationMethods: ['embedContent'],
    },
    {
      name: 'models/imagen-4',
      displayName: 'Imagen',
      supportedGenerationMethods: ['generateContent'],
    },
    {
      name: 'models/gemma-3-27b-it',
      displayName: 'Gemma',
      supportedGenerationMethods: ['generateContent'],
    },
  ],
}

describe('Gemini 모델 정규화', () => {
  it('텍스트 생성용 Gemini만 남긴다', () => {
    const models = normalizeModels(rawModels)
    expect(models.map(model => model.id)).toEqual([
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ])
    expect(models[2].isLite).toBe(true)
    expect(models[1].isFlash).toBe(true)
  })

  it('무료 한도가 넉넉한 Flash-Lite를 우선 추천한다', () => {
    const models = normalizeModels(rawModels)
    expect(pickBestModel(models)).toBe('gemini-2.5-flash-lite')
  })

  it('Lite가 없으면 최신 Flash를 고른다', () => {
    const models = normalizeModels({
      models: [
        { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      ],
    })
    expect(pickBestModel(models)).toBe('gemini-2.5-flash')
  })

  it('목록이 비면 null을 돌려준다', () => {
    expect(pickBestModel([])).toBeNull()
    expect(normalizeModels({})).toEqual([])
    expect(normalizeModels(null)).toEqual([])
  })

  it('표시 이름이 없으면 id를 쓴다', () => {
    const models = normalizeModels(rawModels)
    expect(modelLabel(models, 'gemini-2.5-flash')).toBe('Gemini 2.5 Flash')
    expect(modelLabel(models, 'unknown-model')).toBe('unknown-model')
    expect(modelLabel(models, null)).toBe('모델 미선택')
  })
})

describe('JSON 파서', () => {
  it('순수 JSON을 파싱한다', () => {
    expect(parseJsonLoose<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('```json 코드펜스를 벗겨낸다', () => {
    const raw = '```json\n{"total": 87, "items": []}\n```'
    expect(parseJsonLoose<{ total: number }>(raw).total).toBe(87)
  })

  it('앞뒤 설명이 섞여도 객체를 꺼낸다', () => {
    const raw = '채점 결과입니다.\n{"total": 72}\n위와 같습니다.'
    expect(parseJsonLoose<{ total: number }>(raw).total).toBe(72)
  })

  it('배열 응답도 읽는다', () => {
    const raw = '결과: [{"title":"A"},{"title":"B"}]'
    const parsed = parseJsonLoose<{ title: string }[]>(raw)
    expect(parsed).toHaveLength(2)
  })

  it('JSON이 아니면 BAD_RESPONSE 오류를 던진다', () => {
    try {
      parseJsonLoose('그냥 텍스트')
      throw new Error('should not reach')
    } catch (error) {
      expect(error).toBeInstanceOf(GeminiError)
      expect((error as GeminiError).code).toBe('BAD_RESPONSE')
    }
  })
})
