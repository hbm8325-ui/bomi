import { describe, expect, it } from 'vitest'
import { BUILTIN_SCENARIOS, findBuiltin } from '../src/data/scenarios'
import {
  CUSTOM_SCENARIO_PROMPT,
  GEN_SCENARIO_SCHEMA,
  GRADE_SCHEMA,
  buildAgentContents,
  buildAgentSystem,
  buildGradePrompt,
  buildGradeSystem,
  buildRehearsalPrompt,
  buildScenarioGenSystem,
  buildScenarioGenUser,
  chatLogToText,
} from '../src/logic/prompts'
import type { ChatMessage } from '../src/types'

const scenario = findBuiltin('s1-pr-oel') ?? BUILTIN_SCENARIOS[0]
const entryScenario = findBuiltin('s5-night-shift-complaint') ?? BUILTIN_SCENARIOS[0]

describe('AI Agent 시스템 프롬프트', () => {
  const system = buildAgentSystem(scenario)

  it('과제·미션·자료 원문·함정을 모두 담는다', () => {
    expect(system).toContain(scenario.title)
    expect(system).toContain(scenario.mission)
    expect(system).toContain('PGMEA')
    expect(system).toContain('용제 X')
    expect(system).toContain('함정')
    expect(system).toContain('| 구성물질')
  })

  it('외부 AI처럼 자유롭게 답하도록 지시한다', () => {
    expect(system).toContain('실제 외부 AI')
    expect(system).toContain('일반 산업안전보건 지식')
    expect(system).toContain('중대재해처벌법')
    expect(system).toContain('이해관계자 설득')
    expect(system).toContain('자료에 근거가 없다는 이유로 모든 답변을 막지 않는다')
  })

  it('넓은 질문에는 교과서적 일반론, 좁은 질문에는 정확한 분석을 지시한다', () => {
    expect(system).toContain('교과서적 일반론')
    expect(system).toContain('먼저 떠먹여 주지')
    expect(system).toContain('날카롭게 분석·계산·초안화')
  })

  it('가상의 사내 데이터는 외부 AI처럼 구분해 답하게 한다', () => {
    expect(system).toContain('제시된 자료에는 해당 내부 기록이')
    expect(system).toContain('일반적인 기준으로는')
  })

  it('과제 난이도를 시스템 프롬프트에 표시한다', () => {
    const entry = buildAgentSystem(entryScenario)
    expect(entry).toContain(entryScenario.title)
    expect(entry).toContain('입문')
  })

  it('채점 기준 언급을 금지한다', () => {
    expect(system).toContain('채점 기준')
    expect(system).toContain('절대 언급하지 않는다')
  })

  it('대화 이력을 user/model 교대로 정리한다', () => {
    const chat: ChatMessage[] = [
      { id: '1', role: 'ai', text: '먼저 인사', at: 1 },
      { id: '2', role: 'user', text: '질문1', at: 2 },
      { id: '3', role: 'user', text: '질문2', at: 3 },
      { id: '4', role: 'ai', text: '답변', at: 4 },
    ]
    const contents = buildAgentContents(chat)
    expect(contents[0].role).toBe('user')
    expect(contents[0].parts[0].text).toContain('질문1')
    expect(contents[0].parts[0].text).toContain('질문2')
    expect(contents[1].role).toBe('model')
  })

  it('오류 메시지는 대화 이력에서 뺀다', () => {
    const chat: ChatMessage[] = [
      { id: '1', role: 'user', text: '질문', at: 1 },
      { id: '2', role: 'ai', text: '한도 초과', at: 2, error: true },
    ]
    const contents = buildAgentContents(chat)
    expect(contents).toHaveLength(1)
    expect(contents[0].role).toBe('user')
  })
})

describe('채점 프롬프트', () => {
  const chat: ChatMessage[] = [
    { id: '1', role: 'user', text: '자료 1과 2의 수치를 비교표로 정리해 줘', at: 1 },
    { id: '2', role: 'ai', text: '표입니다.', at: 2 },
  ]
  const prompt = buildGradePrompt(scenario, '결론적으로 C안을 적용합니다.', chat)

  it('답안과 질문 로그를 그대로 넣는다', () => {
    expect(prompt).toContain('결론적으로 C안을 적용합니다.')
    expect(prompt).toContain('자료 1과 2의 수치를 비교표로 정리해 줘')
  })

  it('4개 배점과 4개 꼬리질문·1분30초 발표를 요구한다', () => {
    expect(prompt).toContain('problem/prompt/domain/structure')
    expect(prompt).toContain('정확히 4개')
    expect(prompt).toContain('1분 30초')
    expect(prompt).toContain('quote')
  })

  it('함정 목록을 채점 기준으로 제공한다', () => {
    for (const trap of scenario.traps) {
      expect(prompt).toContain(trap.title)
    }
  })

  it('평가위원 시스템 프롬프트에 감점 원칙이 있다', () => {
    const system = buildGradeSystem()
    expect(system).toContain('통짜 요청은 감점')
    expect(system).toContain('found=false')
  })

  it('대화 로그 평문에는 화자 표기가 들어간다', () => {
    const text = chatLogToText(chat)
    expect(text).toContain('지원자:')
    expect(text).toContain('AI Agent:')
    expect(chatLogToText([])).toContain('없음')
  })

  it('JSON 스키마에 필수 키가 있다', () => {
    const required = (GRADE_SCHEMA as { required: string[] }).required
    expect(required).toEqual(
      expect.arrayContaining(['items', 'overall', 'traps', 'followUps', 'presentation']),
    )
    const itemProps = (GRADE_SCHEMA as {
      properties: { items: { items: { properties: { key: { enum: string[] } } } } }
    }).properties.items.items.properties
    expect(itemProps.key.enum).toEqual(['problem', 'prompt', 'domain', 'structure'])
  })
})

describe('꼬리질문 리허설 프롬프트', () => {
  it('질문·의도·모범 포인트·방어 답변을 담는다', () => {
    const { system, user } = buildRehearsalPrompt(
      scenario,
      { question: '왜 C안입니까?', intent: '근거 검증', points: ['4일 일정', '0.60 m/s'] },
      '2주 안에 끝나기 때문입니다.',
    )
    expect(user).toContain('왜 C안입니까?')
    expect(user).toContain('0.60 m/s')
    expect(user).toContain('2주 안에 끝나기 때문입니다.')
    expect(system).toContain('결론 먼저')
    expect(system).toContain('놓친 리스크')
    expect(system).toContain('250자')
  })
})

describe('과제 생성 프롬프트', () => {
  it('스키마에 필요한 필드가 있다', () => {
    const required = (GEN_SCENARIO_SCHEMA as { required: string[] }).required
    expect(required).toEqual(expect.arrayContaining(['title', 'background', 'mission', 'resources', 'traps']))
  })

  it('difficulty·modelAnswer 선택 필드가 스키마에 있다', () => {
    const props = (GEN_SCENARIO_SCHEMA as {
      properties: {
        difficulty: { enum: string[] }
        modelAnswer: { properties: Record<string, unknown>; required: string[] }
      }
    }).properties
    expect(props.difficulty.enum).toEqual(['입문', '보통', '심화'])
    expect(Object.keys(props.modelAnswer.properties)).toEqual(['report', 'points', 'samplePrompts'])
    expect(props.modelAnswer.required).toEqual(['report', 'points', 'samplePrompts'])
  })

  it('키워드가 있으면 그 주제로, 없으면 최근 EHS 이슈로 만든다', () => {
    expect(buildScenarioGenUser('TMAH 누출')).toContain('TMAH 누출')
    expect(buildScenarioGenUser('  ')).toContain('직접 골라라')
    expect(buildScenarioGenUser('  ')).toContain('modelAnswer')
  })

  it('출제위원 프롬프트가 상황 판단 중심·difficulty·modelAnswer를 요구한다', () => {
    const system = buildScenarioGenSystem()
    expect(system).toContain('함정')
    expect(system).toContain('상황 판단')
    expect(system).toContain('difficulty')
    expect(system).toContain('modelAnswer')
    expect(system).toContain('900~1,400자')
    expect(system).toContain('JSON')
  })

  it('복사용 프롬프트에 앱 JSON 형식과 difficulty·modelAnswer가 들어 있다', () => {
    expect(CUSTOM_SCENARIO_PROMPT).toContain('"resources"')
    expect(CUSTOM_SCENARIO_PROMPT).toContain('"traps"')
    expect(CUSTOM_SCENARIO_PROMPT).toContain('"keywords"')
    expect(CUSTOM_SCENARIO_PROMPT).toContain('"difficulty"')
    expect(CUSTOM_SCENARIO_PROMPT).toContain('"modelAnswer"')
    expect(CUSTOM_SCENARIO_PROMPT).toContain('3,000자')
    expect(CUSTOM_SCENARIO_PROMPT).toContain('상황 판단')
  })
})
