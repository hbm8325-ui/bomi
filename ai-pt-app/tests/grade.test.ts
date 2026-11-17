import { describe, expect, it } from 'vitest'
import { BUILTIN_SCENARIOS, findBuiltin } from '../src/data/scenarios'
import { demoGrade, ensureFollowUps, normalizeGrade, splitSentences } from '../src/logic/grade'
import { classifyPrompt } from '../src/logic/coach'
import { demoReply, demoRehearsalFeedback } from '../src/logic/demo'
import type { ChatMessage } from '../src/types'

const scenario = findBuiltin('s2-etch-exhaust') ?? BUILTIN_SCENARIOS[1]

const raw = {
  items: [
    { key: 'problem', score: 21, comment: '문제를 좁혔다', evidence: '결정 변수를 3개로' },
    { key: 'prompt', score: 33, comment: '표 비교 요청 좋음' },
    { key: 'domain', score: 19, comment: '법적 기준 우선' },
    { key: 'structure', score: 14, comment: '두괄식' },
  ],
  overall: '전체적으로 균형이 좋습니다.',
  strengths: ['근거 인용', '일정 제시'],
  improvements: ['잔여 위험 수치화'],
  traps: [
    { title: '소모품(미스트 필터) 문제로 오진', found: true, evidence: '댐퍼 15도 언급' },
    { title: '월·주간 평균만 보고 정상 판정', found: false, evidence: '' },
  ],
  followUps: [
    {
      question: '왜 댐퍼를 원복해야 한다고 판단했습니까?',
      intent: '근거 검증',
      points: ['자료 1의 11/05 조정 이력', '설비기술팀 복귀 추정치 0.52'],
      quote: '댐퍼를 완전 원복하면 0.52 m/s로 복귀합니다',
    },
  ],
  presentation: {
    hook: '3호기 가동은 조건부로 유지합니다.',
    frame: '원인은 댐퍼와 PM 연기입니다.',
    solution: '오늘 PM으로 댐퍼를 원복하고 송기마스크를 착용합니다.',
    close: '이상입니다.',
  },
}

describe('채점 결과 정규화', () => {
  it('4개 항목을 배점 순서대로 채우고 총점을 다시 계산한다', () => {
    const grade = normalizeGrade(raw, scenario)
    expect(grade.items.map(item => item.key)).toEqual(['problem', 'prompt', 'domain', 'structure'])
    expect(grade.items[1].score).toBe(30) // 33 → 30 상한
    expect(grade.total).toBe(84)
    expect(grade.items[0].evidence).toBe('결정 변수를 3개로')
  })

  it('항목이 빠지면 0점으로 채우고 코멘트 안내를 넣는다', () => {
    const grade = normalizeGrade({ ...raw, items: [{ key: 'problem', score: 10, comment: 'ok' }] }, scenario)
    expect(grade.items).toHaveLength(4)
    expect(grade.items[3].score).toBe(0)
    expect(grade.items[3].comment).toContain('제공되지 않았')
    expect(grade.total).toBe(10)
  })

  it('음수·NaN 점수는 0으로, 상한 초과는 상한으로 자른다', () => {
    const grade = normalizeGrade(
      {
        ...raw,
        items: [
          { key: 'problem', score: -5, comment: '' },
          { key: 'prompt', score: 'x', comment: '' },
          { key: 'domain', score: 99, comment: '' },
          { key: 'structure', score: 19.55, comment: '' },
        ],
      },
      scenario,
    )
    expect(grade.items[0].score).toBe(0)
    expect(grade.items[1].score).toBe(0)
    expect(grade.items[2].score).toBe(25)
    expect(grade.items[3].score).toBe(19.6)
  })

  it('함정 목록은 과제 기준으로 채우고 없으면 놓침 처리한다', () => {
    const grade = normalizeGrade(raw, scenario)
    expect(grade.traps).toHaveLength(scenario.traps.length)
    expect(grade.traps[0].found).toBe(true)
    expect(grade.traps[1].found).toBe(false)
    expect(grade.traps[2].found).toBe(false)
    expect(grade.traps[2].evidence).toBe('')
  })

  it('꼬리질문이 1개여도 4개로 늘린다', () => {
    const grade = normalizeGrade(raw, scenario)
    expect(grade.followUps).toHaveLength(4)
    expect(grade.followUps[0].question).toContain('댐퍼')
    expect(grade.followUps[1].question.length).toBeGreaterThan(10)
    expect(grade.followUps[0].points.length).toBeGreaterThan(0)
  })

  it('발표 뼈대 4단이 모두 문자열로 채워진다', () => {
    const grade = normalizeGrade({}, scenario, '결론적으로 3호기는 조건부 가동합니다. 댐퍼를 원복합니다.', [])
    for (const part of Object.values(grade.presentation)) {
      expect(typeof part).toBe('string')
    }
    expect(grade.presentation.hook.length).toBeGreaterThan(0)
    expect(grade.total).toBe(0)
  })

  it('꼬리질문을 4개 초과로 주면 4개만 남긴다', () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      question: `질문 ${index}`,
      intent: '의도',
      points: ['a'],
    }))
    const followUps = ensureFollowUps(scenario, many, '', [])
    expect(followUps).toHaveLength(4)
    expect(followUps[3].question).toBe('질문 3')
  })

  it('문장 분리는 한국어 종결을 기준으로 한다', () => {
    const sentences = splitSentences('첫 문장입니다. 두 번째 문장입니다! 세 번째?')
    expect(sentences.length).toBeGreaterThanOrEqual(3)
  })
})

describe('데모 채점', () => {
  const answer = `결론적으로 3호기는 조건부로 가동하고 오늘 PM으로 댐퍼를 원복해야 합니다.
원인은 11/05 댐퍼 15° 조정과 11/06 PM 연기입니다. 미스트 필터는 10/28 교체되어 차압 12 mmH₂O로 정상입니다.
정지 시 손실은 8.1억 원, 3조건 가동은 0.18억 원입니다. 제어풍속은 0.38 m/s로 기준 0.50의 76%입니다.
톨루엔 STEL은 118 ppm으로 기준 100 ppm을 초과했습니다.
실행계획은 오늘 댐퍼 원복, 5일간 송기식 호흡보호구 착용, 11/18 덕트 청소 완료 확인입니다.`

  const targetedChat: ChatMessage[] = [
    { id: '1', role: 'user', text: '1·2·3호기 제어풍속을 주차별로 표로 정리하고 하락 시점을 표시해 줘', at: 1 },
    { id: '2', role: 'ai', text: '표입니다.', at: 2 },
    { id: '3', role: 'user', text: '표 3의 조건별 합계 손실을 다시 계산하고 계산 범위를 밝혀 줘', at: 3 },
  ]

  const broadChat: ChatMessage[] = [
    { id: '1', role: 'user', text: '보고서 다 써줘', at: 1 },
    { id: '2', role: 'ai', text: '일반 원칙입니다.', at: 2 },
    { id: '3', role: 'user', text: '해결책 알려줘', at: 3 },
  ]

  it('총점 0~100, 항목 4개, 함정 리포트, 꼬리질문 4개를 만든다', () => {
    const grade = demoGrade(scenario, answer, targetedChat)
    expect(grade.total).toBeGreaterThan(0)
    expect(grade.total).toBeLessThanOrEqual(100)
    expect(grade.items).toHaveLength(4)
    expect(grade.traps).toHaveLength(scenario.traps.length)
    expect(grade.followUps).toHaveLength(4)
    expect(grade.demo).toBe(true)
    expect(grade.presentation.hook.length).toBeGreaterThan(0)
  })

  it('좁은 질문 로그가 넓은 요청 로그보다 ② 항목 점수가 높다', () => {
    const good = demoGrade(scenario, answer, targetedChat)
    const bad = demoGrade(scenario, answer, broadChat)
    const goodPrompt = good.items.find(item => item.key === 'prompt')!.score
    const badPrompt = bad.items.find(item => item.key === 'prompt')!.score
    expect(goodPrompt).toBeGreaterThan(badPrompt)
    expect(bad.improvements.join(' ')).toContain('넓은 요청')
  })

  it('자료 수치를 인용하면 함정을 짚은 것으로 표시된다', () => {
    const grade = demoGrade(scenario, answer, targetedChat)
    const found = grade.traps.filter(trap => trap.found)
    expect(found.length).toBeGreaterThanOrEqual(2)
  })

  it('빈 답안은 낮은 점수를 주되 형식은 유지한다', () => {
    const grade = demoGrade(scenario, '', [])
    expect(grade.total).toBeLessThan(40)
    expect(grade.items).toHaveLength(4)
    expect(grade.traps).toHaveLength(scenario.traps.length)
  })
})

describe('프롬프트 성향 감지 · 데모 응답', () => {
  it('넓은 요청을 broad로 잡고 팁을 준다', () => {
    for (const text of ['보고서 다 써줘', '해결책 알려줘', '전체 요약해 줘', '어떻게 해야 해']) {
      const verdict = classifyPrompt(text)
      expect(verdict.kind).toBe('broad')
      expect(verdict.tip).toBeTruthy()
    }
  })

  it('자료·표·수치를 지정한 요청은 targeted로 잡는다', () => {
    const samples = [
      '자료 1과 자료 2의 수치를 비교 표로 정리하고 없는 항목은 자료 없음으로 표기해 줘',
      '표 3의 조건별 합계 손실을 다시 계산해 줘',
      '톨루엔 STEL 118 ppm이 기준 100 ppm 대비 얼마나 초과인지 계산해 줘',
      '자료 1에서 OEL 미설정 물질만 골라 증기압 순으로 정리해 줘',
    ]
    for (const text of samples) {
      expect(classifyPrompt(text).kind).toBe('targeted')
    }
  })

  it('데모 응답은 넓은 질문과 좁은 질문이 다르다', () => {
    const s1 = findBuiltin('s1-pr-oel') ?? BUILTIN_SCENARIOS[0]
    const broad = demoReply(s1, '보고서 다 써줘')
    const narrow = demoReply(s1, '용제 X의 포화증기 기여를 몰분율로 계산해 줘')
    expect(broad).not.toBe(narrow)
    expect(broad).toContain('일반적으로')
    expect(narrow).toContain('0.037')
    expect(narrow).toContain('11.2%')
  })

  it('데모 응답이 넓은 질문에서 함정을 먼저 폭로하지 않는다', () => {
    const s1 = findBuiltin('s1-pr-oel') ?? BUILTIN_SCENARIOS[0]
    const broad = demoReply(s1, '해결책 알려줘')
    expect(broad).not.toContain('용제 X')
    expect(broad).not.toContain('댐퍼')
  })

  it('데모 리허설 피드백은 3줄로 돌아온다', () => {
    const lines = demoRehearsalFeedback('왜 댐퍼를 원복했나요?', '댐퍼가 15도 닫혀 있었기 때문입니다. 11/05 조정 이력이 자료 1에 있습니다.')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('결론 먼저')
    expect(lines[1]).toContain('자료 근거')
    expect(lines[2]).toContain('놓친 리스크')
  })

  it('짧은 답변에는 더 강한 코칭을 준다', () => {
    const lines = demoRehearsalFeedback('질문', '몰라요')
    expect(lines[0]).toContain('짧')
  })
})
