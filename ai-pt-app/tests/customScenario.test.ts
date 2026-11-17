import { beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_STORAGE_KEY,
  deleteCustomScenario,
  exportCustomJson,
  loadCustomScenarios,
  parseContentBlocks,
  parseScenarioJson,
  saveCustomScenarios,
  stripToJson,
  upsertCustomScenario,
} from '../src/logic/customScenario'

const validJson = {
  title: '클린룸 TMAH 누출 대응',
  field: '보건',
  background:
    '클린룸 세정 라인에서 TMAH 2.38% 용액을 사용한다. 배관 교체 작업 중 누출 가능성이 제기되었고, 작업은 3일 뒤 예정이다.',
  mission: '3,000자 이내로, 누출 대응과 작업 재개 판단을 담은 보고서를 작성하시오.',
  constraints: ['답안 3,000자 이내', '결론을 먼저'],
  resources: [
    {
      label: '자료 1',
      title: 'TMAH 물성·독성.pdf',
      summary: 'TMAH 노출기준과 건강영향',
      content: 'TMAH는 피부 흡수와 화학적 화상 위험이 있다.\n\n| 항목 | 값 |\n| --- | --- |\n| TWA | 0.5 ppm |\n| pH | 13.5 |\n\n- 주1) 국내 기준 확인 필요',
    },
    {
      label: '자료 2',
      title: '배관 교체 공정 일정.pdf',
      summary: '작업 조건과 대안',
      content: '| 대안 | 기간 | 비용 |\n| --- | --- | --- |\n| A 즉시 교체 | 2일 | 0.3억 |\n| B 임시 보수 | 4시간 | 0.05억 |',
    },
  ],
  traps: [
    {
      title: 'ppm 기준을 %로 오인',
      detail: 'TMAH 2.38%는 ppm이 아니라 중량%이며, 노출기준 0.5 ppm과 단위를 맞춰야 한다.',
      keywords: ['2.38%', 'ppm', '단위'],
    },
  ],
}

describe('커스텀 과제 JSON 파서', () => {
  it('단일 객체를 과제로 만든다', () => {
    const outcome = parseScenarioJson(JSON.stringify(validJson))
    expect(outcome.ok).toBe(true)
    expect(outcome.errors).toEqual([])
    expect(outcome.scenarios).toHaveLength(1)
    const scenario = outcome.scenarios[0]
    expect(scenario.source).toBe('custom')
    expect(scenario.code).toBe('사용자 과제')
    expect(scenario.resources).toHaveLength(2)
    expect(scenario.traps[0].keywords).toContain('단위')
    expect(scenario.title).toContain('TMAH')
  })

  it('코드펜스로 감싼 JSON도 파싱한다', () => {
    const raw = '```json\n' + JSON.stringify(validJson) + '\n```'
    expect(stripToJson(raw).startsWith('{')).toBe(true)
    const outcome = parseScenarioJson(raw)
    expect(outcome.ok).toBe(true)
    expect(outcome.scenarios).toHaveLength(1)
  })

  it('코드펜스 앞뒤에 설명이 있어도 파싱한다', () => {
    const raw = `문제를 만들어 봤습니다!\n\`\`\`json\n${JSON.stringify(validJson)}\n\`\`\`\n필요하면 더 만들어 드릴게요.`
    const outcome = parseScenarioJson(raw)
    expect(outcome.ok).toBe(true)
  })

  it('배열로 여러 과제를 한 번에 추가한다', () => {
    const second = { ...validJson, title: '신규 설비 위험성평가', field: '공통' }
    const outcome = parseScenarioJson(JSON.stringify([validJson, second]))
    expect(outcome.ok).toBe(true)
    expect(outcome.scenarios).toHaveLength(2)
    expect(outcome.scenarios.map(item => item.title)).toEqual(['클린룸 TMAH 누출 대응', '신규 설비 위험성평가'])
  })

  it('{ scenarios: [...] } 형태도 허용한다', () => {
    const outcome = parseScenarioJson(JSON.stringify({ scenarios: [validJson] }))
    expect(outcome.ok).toBe(true)
    expect(outcome.scenarios).toHaveLength(1)
  })

  it('필수 필드가 없으면 한국어 오류를 돌려준다', () => {
    const broken = { ...validJson, mission: '', resources: [] }
    const outcome = parseScenarioJson(JSON.stringify(broken))
    expect(outcome.ok).toBe(false)
    expect(outcome.scenarios).toHaveLength(0)
    expect(outcome.errors.join(' ')).toContain('mission')
    expect(outcome.errors.join(' ')).toContain('resources')
  })

  it('JSON이 깨졌으면 형식 오류를 알린다', () => {
    const outcome = parseScenarioJson('{ title: 클린룸 }')
    expect(outcome.ok).toBe(false)
    expect(outcome.errors[0]).toContain('JSON')
  })

  it('빈 문자열은 오류로 처리한다', () => {
    const outcome = parseScenarioJson('   ')
    expect(outcome.ok).toBe(false)
    expect(outcome.errors[0]).toContain('비어')
  })

  it('자료가 1개면 경고만 남기고 통과시킨다', () => {
    const outcome = parseScenarioJson(JSON.stringify({ ...validJson, resources: [validJson.resources[0]] }))
    expect(outcome.ok).toBe(true)
    expect(outcome.warnings.join(' ')).toContain('1개')
  })

  it('함정이 없으면 경고를 남긴다', () => {
    const outcome = parseScenarioJson(JSON.stringify({ ...validJson, traps: [] }))
    expect(outcome.ok).toBe(true)
    expect(outcome.warnings.join(' ')).toContain('함정')
  })

  it('마크다운 표를 표 블록으로 변환한다', () => {
    const blocks = parseContentBlocks('도입 문단\n\n| 항목 | 값 |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n\n- 첫째\n- 둘째')
    expect(blocks[0]).toEqual({ kind: 'text', text: '도입 문단' })
    const table = blocks.find(block => block.kind === 'table')
    expect(table).toBeTruthy()
    if (table?.kind === 'table') {
      expect(table.table.head).toEqual(['항목', '값'])
      expect(table.table.rows).toHaveLength(2)
      expect(table.table.rows[1]).toEqual(['B', '2'])
    }
    const bullets = blocks.find(block => block.kind === 'bullets')
    expect(bullets).toBeTruthy()
  })

  it('내보낸 JSON을 다시 불러올 수 있다(왕복)', () => {
    const first = parseScenarioJson(JSON.stringify(validJson)).scenarios[0]
    const exported = exportCustomJson([first])
    const again = parseScenarioJson(exported)
    expect(again.ok).toBe(true)
    expect(again.scenarios[0].title).toBe(first.title)
    expect(again.scenarios[0].resources[0].title).toBe(first.resources[0].title)
    expect(again.scenarios[0].traps[0].title).toBe(first.traps[0].title)
    const table = again.scenarios[0].resources[0].blocks.find(block => block.kind === 'table')
    expect(table).toBeTruthy()
  })

  it('difficulty와 modelAnswer를 함께 읽고 내보낸다', () => {
    const withExtras = {
      ...validJson,
      difficulty: '보통',
      modelAnswer: {
        report: '결론적으로 조건부 사용을 중지하고 승인 절차를 다시 밟습니다.'.repeat(10),
        points: ['포인트1', '포인트2', '포인트3'],
        samplePrompts: ['표 1과 2를 합쳐 정리해 줘', '승인 일정을 일자별로 계산해 줘'],
      },
    }
    const scenario = parseScenarioJson(JSON.stringify(withExtras)).scenarios[0]
    expect(scenario.difficulty).toBe('보통')
    expect(scenario.modelAnswer?.report).toContain('결론적으로')
    expect(scenario.modelAnswer?.points).toHaveLength(3)
    expect(scenario.modelAnswer?.samplePrompts).toHaveLength(2)

    const again = parseScenarioJson(exportCustomJson([scenario])).scenarios[0]
    expect(again.difficulty).toBe('보통')
    expect(again.modelAnswer?.report).toBe(scenario.modelAnswer?.report)
    expect(again.modelAnswer?.samplePrompts).toEqual(scenario.modelAnswer?.samplePrompts)
  })

  it('difficulty가 이상한 값이면 경고 후 무시한다', () => {
    const outcome = parseScenarioJson(JSON.stringify({ ...validJson, difficulty: '최상' }))
    expect(outcome.ok).toBe(true)
    expect(outcome.scenarios[0].difficulty).toBeUndefined()
    expect(outcome.warnings.join(' ')).toContain('difficulty')
  })

  it('modelAnswer에 report가 없으면 저장하지 않는다', () => {
    const scenario = parseScenarioJson(
      JSON.stringify({ ...validJson, modelAnswer: { points: ['a'], samplePrompts: ['b'] } }),
    ).scenarios[0]
    expect(scenario.modelAnswer).toBeUndefined()
  })
})

describe('커스텀 과제 localStorage 저장/삭제', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('추가하면 저장되고 다시 읽힌다', () => {
    const scenario = parseScenarioJson(JSON.stringify(validJson)).scenarios[0]
    const after = upsertCustomScenario(scenario)
    expect(after).toHaveLength(1)
    expect(localStorage.getItem(CUSTOM_STORAGE_KEY)).toBeTruthy()
    const loaded = loadCustomScenarios()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].title).toBe(validJson.title)
    expect(loaded[0].source).toBe('custom')
  })

  it('같은 id를 다시 저장하면 수정된다(중복 없음)', () => {
    const scenario = parseScenarioJson(JSON.stringify(validJson)).scenarios[0]
    upsertCustomScenario(scenario)
    const edited = { ...scenario, title: '수정된 제목' }
    const after = upsertCustomScenario(edited)
    expect(after).toHaveLength(1)
    expect(after[0].title).toBe('수정된 제목')
  })

  it('삭제하면 목록과 저장소에서 빠진다', () => {
    const scenario = parseScenarioJson(JSON.stringify(validJson)).scenarios[0]
    upsertCustomScenario(scenario)
    const after = deleteCustomScenario(scenario.id)
    expect(after).toHaveLength(0)
    expect(loadCustomScenarios()).toHaveLength(0)
  })

  it('저장소 값이 깨져 있으면 빈 목록을 돌려준다', () => {
    localStorage.setItem(CUSTOM_STORAGE_KEY, 'not-json')
    expect(loadCustomScenarios()).toEqual([])
  })

  it('배열 형태로 저장된 예전 데이터도 읽는다', () => {
    const scenario = parseScenarioJson(JSON.stringify(validJson)).scenarios[0]
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify([scenario]))
    const loaded = loadCustomScenarios()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].traps).toHaveLength(1)
  })

  it('saveCustomScenarios로 한 번에 저장한다', () => {
    const scenario = parseScenarioJson(JSON.stringify(validJson)).scenarios[0]
    expect(saveCustomScenarios([scenario])).toBe(true)
    expect(loadCustomScenarios()).toHaveLength(1)
  })
})
