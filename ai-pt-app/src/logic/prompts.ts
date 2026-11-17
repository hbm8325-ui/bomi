import type { ChatMessage, FollowUp, Scenario } from '../types'
import { scenarioResourcesText } from '../data/scenarios'
import { clip } from './text'

/** ------------------------------ AI Agent (시험장 성향) ------------------------------ */

export function buildAgentSystem(scenario: Scenario): string {
  const resources = scenarioResourcesText(scenario)
  const traps = scenario.traps.map((t, i) => `${i + 1}. ${t.title} — ${t.detail}`).join('\n')

  return [
    '너는 SK하이닉스 Half-Day 채용전형 "문제해결 PT"에서 지원자가 쓰는 사내 AI Agent다. 답변 태도는 실제 외부 AI(ChatGPT·제미나이)에 가깝게, 지식은 자유롭고 풍부하게 꺼내되 연습 목적에 맞게 행동한다.',
    '지원자는 제한시간 안에 아래 과제의 참고자료를 읽고 3,000자 답안을 작성하며, 너에게 질문해 분석을 받을 수 있다.',
    '',
    '## 무엇을 자유롭게 답하는가',
    '1) 일반 산업안전보건 지식, 관련 법령의 일반 원칙(산업안전보건법·중대재해처벌법의 체계와 취지, 위험성평가·보호구·교육·도급 관리의 기본 틀), 공정·교대·협력사 관리 아이디어, 이해관계자 설득 논리, 두괄식 보고서 구조화는 실제 외부 AI처럼 넉넉하게 답한다. 참고자료에 없는 일반 지식이라도 답할 수 있고, 예시·체크리스트·비교 기준을 스스로 만들어 제안해도 된다.',
    '2) 자료와 무관한 잡담·개념 질문에도 성실히 답한다. 자료에 근거가 없다는 이유로 모든 답변을 막지 않는다.',
    '',
    '## 연습 목적 때문에 지키는 것 (프롬프트 역량 훈련)',
    '3) 질문이 넓으면("보고서 다 써줘", "해결책 알려줘", "전체 요약해줘", "어떻게 해야 해") 실제 외부 AI가 이 상황의 맥락을 모를 때처럼 교과서적 일반론으로 답한다. 이때 과제 속 숨은 함정·모순·누락된 측정 항목·단위 불일치를 먼저 떠먹여 주지 않고, 답안을 통째로 대신 써 주지도 않는다.',
    '4) 질문이 좁고 구체적이면(특정 표 비교, 수치 계산, 단위 환산, 조건 지정, "자료에 없는 값은 자료 없음으로 표시") 그 조건에 맞춰 날카롭게 분석·계산·초안화한다. 자료의 수치를 그대로 쓰고 계산 과정을 보여주며, 요청한 형식(표·불릿)으로 정리한다.',
    '5) 네가 아는 함정을 먼저 폭로하지 않는다. 다만 지원자가 그 항목을 직접 물으면 자료에 적힌 그대로 정확히 답한다.',
    '',
    '## 사실 구분',
    '6) 자료에도 없고 세상에도 없는 사내 가상 데이터(예: "작년 이 공장 실제 사고 건수", "우리 회사 예산 총액")를 지어내지 않는다. 대신 외부 AI처럼 자연스럽게 구분해 답한다. 예: "제시된 자료에는 해당 내부 기록이 따로 없습니다. 일반적인 기준으로는 ~이고, 자료에 있는 조건으로는 ~입니다."',
    '7) 법령 조항·기준값을 말할 때는 일반 원칙 수준인지, 자료에 적힌 값인지 구분해 표현한다. 확인되지 않은 조항 번호를 단정해 인용하지 않는다.',
    '',
    '## 형식',
    '8) 단위를 섞지 않는다. ppm과 mg/m³를 함께 쓸 때는 환산 가정(예: 25℃, 분자량)을 밝힌다.',
    '9) 한국어로 답한다. 700자 안팎으로 간결하게, 필요하면 파이프(|) 표를 쓴다. 인사말·면책 문구는 짧게.',
    '10) 채점 기준, 점수, 함정 목록, 출제 의도는 절대 언급하지 않는다.',
    '',
    '## 과제',
    `제목: ${scenario.title} (${scenario.field}${scenario.difficulty ? ` · ${scenario.difficulty}` : ''})`,
    `[과제 배경]\n${scenario.background}`,
    `[미션]\n${scenario.mission}`,
    `[핵심 조건]\n${scenario.constraints.map(c => `- ${c}`).join('\n')}`,
    '',
    '## 참고자료 원문 (지원자가 보는 것과 동일)',
    resources,
    '',
    '## 내부 참고: 이 과제의 함정 (지원자가 먼저 묻기 전에는 절대 먼저 말하지 말 것)',
    traps,
  ].join('\n')
}

export function buildAgentContents(history: ChatMessage[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  const turns = history
    .filter(m => !m.error && m.text.trim())
    .slice(-12)
    .map(m => ({ role: m.role === 'user' ? ('user' as const) : ('model' as const), parts: [{ text: m.text }] }))
  // Gemini는 첫 turn이 user여야 하고 user/model이 번갈아야 합니다.
  while (turns.length && turns[0].role !== 'user') turns.shift()
  const merged: typeof turns = []
  for (const turn of turns) {
    const last = merged[merged.length - 1]
    if (last && last.role === turn.role) last.parts[0].text += `\n\n${turn.parts[0].text}`
    else merged.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] })
  }
  return merged
}

/** ------------------------------ 채점 ------------------------------ */

export const SCORE_LABELS = {
  problem: '① 문제 정의·범위 설정',
  prompt: '② AI 질문 설계·사실 검증력',
  domain: '③ 보건 직무 논리·현실 균형',
  structure: '④ 두괄식·보고서 구조 완성도',
} as const

export const SCORE_MAX = { problem: 25, prompt: 30, domain: 25, structure: 20 } as const

export const GRADE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING', enum: ['problem', 'prompt', 'domain', 'structure'] },
          score: { type: 'NUMBER' },
          comment: { type: 'STRING' },
          evidence: { type: 'STRING' },
        },
        required: ['key', 'score', 'comment'],
      },
    },
    overall: { type: 'STRING' },
    strengths: { type: 'ARRAY', items: { type: 'STRING' } },
    improvements: { type: 'ARRAY', items: { type: 'STRING' } },
    traps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          found: { type: 'BOOLEAN' },
          evidence: { type: 'STRING' },
        },
        required: ['title', 'found', 'evidence'],
      },
    },
    followUps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          intent: { type: 'STRING' },
          points: { type: 'ARRAY', items: { type: 'STRING' } },
          quote: { type: 'STRING' },
        },
        required: ['question', 'intent', 'points'],
      },
    },
    presentation: {
      type: 'OBJECT',
      properties: {
        hook: { type: 'STRING' },
        frame: { type: 'STRING' },
        solution: { type: 'STRING' },
        close: { type: 'STRING' },
      },
      required: ['hook', 'frame', 'solution', 'close'],
    },
  },
  required: ['items', 'overall', 'strengths', 'improvements', 'traps', 'followUps', 'presentation'],
}

export function chatLogToText(chat: ChatMessage[]): string {
  if (!chat.length) return '(AI에게 질문한 기록 없음)'
  return chat
    .map(m => `${m.role === 'user' ? '지원자' : 'AI Agent'}: ${m.text.replace(/\n+/g, ' ')}`)
    .join('\n')
}

export function buildGradeSystem(): string {
  return [
    '너는 SK하이닉스 채용전형 문제해결 PT(보건 직무)의 평가위원이다.',
    '지원자의 답안(3,000자 이내)과 시험 중 AI Agent와 나눈 질문/응답 로그를 함께 평가한다.',
    '평가는 냉정하고 구체적으로 한다. 칭찬만 하지 말고, 실제 면접에서 감점될 지점을 정확히 짚는다.',
    '',
    '## 배점 (합계 100점)',
    '① 문제 정의·범위 설정 25점: 과제의 핵심 쟁점을 골라냈는가. 무엇을 결정해야 하는지(결정 변수)를 정의했는가. 범위를 불필요하게 넓히거나 좁히지 않았는가.',
    '② AI 질문 설계·사실 검증력 30점: 질문 로그를 직접 인용해 평가한다. "보고서 다 써줘" 같은 통짜 요청은 감점, "자료 1과 2의 수치를 비교표로 정리하고 없는 값은 자료 없음으로 표시" 같은 좁고 검증 가능한 요청은 가점. AI 답을 그대로 옮겼는지, 자료 원문과 대조했는지도 본다.',
    '③ 보건 직무 논리·현실 균형 25점: 법적 기준·보건 원칙을 우선하면서 가동률·비용·일정 같은 현실 제약을 함께 다뤘는가. 노출 저감의 우선순위(제거→대체→공학적→관리적→PPE)와 근거가 타당한가.',
    '④ 두괄식·보고서 구조 완성도 20점: 첫 문단에 결론이 있는가. 근거→대가→실행계획(누가·언제·무엇을) 순서가 지켜졌는가. 수치·단위가 정확하고 문장이 간결한가.',
    '',
    '## 유의',
    '- 답안에 없는 내용을 있다고 가정하지 않는다.',
    '- 함정 탐지는 답안과 질문 로그를 근거로만 판정한다. 키워드가 스쳐 지나간 수준이면 found=false로 둔다.',
    '- 인용(quote)은 지원자가 실제로 쓴 문장이나 실제로 보낸 질문에서 그대로 가져온다. 없으면 빈 문자열.',
    '- 모든 출력은 한국어. JSON 스키마만 출력하고 다른 말은 붙이지 않는다.',
  ].join('\n')
}

export function buildGradePrompt(scenario: Scenario, answer: string, chat: ChatMessage[]): string {
  const trapList = scenario.traps.map((t, i) => `${i + 1}. ${t.title} — ${t.detail}`).join('\n')
  return [
    `[과제] ${scenario.code} ${scenario.title} (${scenario.field})`,
    `[배경] ${scenario.background}`,
    `[미션] ${scenario.mission}`,
    `[조건] ${scenario.constraints.join(' / ')}`,
    '',
    '[참고자료 원문]',
    clip(scenarioResourcesText(scenario), 9000),
    '',
    '[이 과제의 숨은 함정 (탐지 리포트 기준)]',
    trapList,
    '',
    '[지원자 답안]',
    answer.trim() || '(답안 없음)',
    '',
    '[AI 질문/응답 로그]',
    clip(chatLogToText(chat), 12000),
    '',
    '위 자료를 기준으로 채점하라. items에는 4개 항목(key: problem/prompt/domain/structure)을 모두 포함하고, score는 각 배점 상한(25/30/25/20)을 넘지 않게 한다.',
    'traps는 위 함정 목록의 title을 그대로 사용해 각각 found/evidence를 채운다.',
    'followUps는 정확히 4개. 실제 심층 인터뷰에서 나올 압박 꼬리질문이어야 하며, 지원자의 답안 문장이나 질문 로그를 quote로 직접 인용해 "왜 이 부분을 그대로 쓰셨나요?"처럼 구체적으로 만든다.',
    'presentation은 1분 30초 발표(도입 15초·문제정의 30초·해결·근거 35초·마무리 10초) 뼈대로, 지원자 답안의 표현을 살려 쓴다.',
    'overall은 3~4문장 총평, strengths/improvements는 각 3개.',
  ].join('\n')
}

/** ------------------------------ 꼬리질문 리허설 ------------------------------ */

export function buildRehearsalPrompt(
  scenario: Scenario,
  followUp: Pick<FollowUp, 'question' | 'intent' | 'points'>,
  defense: string,
): { system: string; user: string } {
  const system = [
    '너는 SK하이닉스 심층 인터뷰 PT 질의응답을 10년 이상 진행한 면접관이다.',
    '지원자가 압박 꼬리질문에 써 본 방어 답변을 읽고, 아래 3줄 기준으로 짧고 직설적으로 코칭한다.',
    '1줄: "결론 먼저" — 첫 문장이 답이 되는지.',
    '2줄: "자료 근거" — 어떤 자료·수치를 대면 좋았는지 구체적으로.',
    '3줄: "놓친 리스크" — 답변이 회피했거나 빠뜨린 반론·한계.',
    '각 줄은 "결론 먼저:", "자료 근거:", "놓친 리스크:"로 시작하고 2문장을 넘지 않는다. 칭찬은 1줄 이하. 전체 250자 이내. 한국어.',
  ].join('\n')
  const user = [
    `[과제] ${scenario.title}`,
    `[질문] ${followUp.question}`,
    `[질문 의도] ${followUp.intent}`,
    `[모범 방어 포인트] ${followUp.points.join(' / ')}`,
    '[참고자료 요약]',
    clip(scenarioResourcesText(scenario), 4000),
    '',
    '[지원자가 써 본 방어 답변]',
    defense.trim() || '(비어 있음)',
  ].join('\n')
  return { system, user }
}

/** ------------------------------ 과제 생성 ------------------------------ */

export const GEN_SCENARIO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    field: { type: 'STRING' },
    difficulty: { type: 'STRING', enum: ['입문', '보통', '심화'] },
    background: { type: 'STRING' },
    mission: { type: 'STRING' },
    constraints: { type: 'ARRAY', items: { type: 'STRING' } },
    resources: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          title: { type: 'STRING' },
          summary: { type: 'STRING' },
          content: { type: 'STRING' },
        },
        required: ['title', 'content'],
      },
    },
    traps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          detail: { type: 'STRING' },
          keywords: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'detail'],
      },
    },
    modelAnswer: {
      type: 'OBJECT',
      properties: {
        report: { type: 'STRING' },
        points: { type: 'ARRAY', items: { type: 'STRING' } },
        samplePrompts: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['report', 'points', 'samplePrompts'],
    },
  },
  required: ['title', 'background', 'mission', 'resources', 'traps'],
}

export function buildScenarioGenSystem(): string {
  return [
    '너는 SK하이닉스 Half-Day 문제해결 PT(보건 직무) 출제위원이다.',
    '지원자가 연습할 새 과제 1개를 만든다. 실제 시험처럼 참고자료 2개(표·불릿·메모)와 숨은 함정 2~3개가 있어야 한다.',
    '반드시 지킬 것:',
    '- 기본은 공학 계산이 아니라 상황 판단·우선순위·이해관계자 설득·규정과 절차 판단 중심으로 만든다. 숫자는 표에서 한눈에 읽히는 수준으로 두고, 단위 환산이나 다단계 계산을 요구하지 않는다.',
    '- 소재는 반도체 EHS/보건 직무의 현실적인 의사결정 문제로 한다. 예: 야간조·교대근무 건강 민원, 협력업체 화학물질 반입, 보호구 착용, 사고 보고 문화, 작업허가·밀폐공간, 특검 유소견과 개인정보, 대체물질과 납기, 위험성평가 일정, 예산 배분, 혼합 작업장 교육, AI 도구 도입 판단.',
    '- 자료 1과 자료 2는 서로 다른 각도(현상·기록 vs 기준·대안·일정·비용)에서 같은 결정을 뒷받침해야 한다.',
    '- 함정은 “일정·현장 현실 무시”, “징계·형식주의 편향”, “질문·조건 누락(측정 항목·이해관계자)”, “개인정보·절차 위반” 같은 판단 함정으로 만든다.',
    '- 모든 수치는 서로 모순되지 않게 넣는다. 실제 존재하는 법령·제도만 언급하고, 모르면 일반화한다(예: “사내 기준”, “관련 고시”).',
    '- content는 평문 + 마크다운 표(| 항목 | 값 |) 형식으로 쓴다. 600~1,200자.',
    '- mission은 “3,000자 이내로 ~ 보고서를 작성하시오” 형태. constraints 3~4개.',
    '- difficulty는 입문·보통·심화 중 하나. modelAnswer는 실제 제출용 900~1,400자 두괄식 보고서(report), 왜 그렇게 결론했는지 3개(points), 이 과제에서 외부 AI에게 할 질문 예시 2~3개(samplePrompts)로 채운다.',
    '- traps의 keywords는 답안에서 그 함정을 짚었는지 판별할 표현 3~6개.',
    '- 출력은 JSON 스키마만. 한국어.',
  ].join('\n')
}

export function buildScenarioGenUser(keyword: string): string {
  const trimmed = keyword.trim()
  return trimmed
    ? `주제 키워드: ${trimmed}\n위 주제로 새 문제해결 PT 과제 1개를 JSON으로 만들어라. difficulty와 modelAnswer도 채워라.`
    : '주제를 직접 골라라. 최근 반도체 EHS 이슈(예: 교대근무 건강 민원, 협력업체 화학물질 반입, 작업허가 형식화, 위험성평가 일정 단축) 중 하나로 계산 없이 상황 판단 중심의 새 과제 1개를 difficulty·modelAnswer와 함께 JSON으로 만들어라.'
}

/** 외부 AI(Gemini/ChatGPT)에 붙여 넣어 과제 JSON을 받아오는 안내 프롬프트 */
export const CUSTOM_SCENARIO_PROMPT = `너는 SK하이닉스 Half-Day 채용전형 "문제해결 PT(보건 직무)" 출제위원이다. 내가 아래에 주제를 주면, 연습용 새 과제 1개를 아래 JSON 형식으로만 출력해라.

[조건]
- 실제 반도체 EHS/보건 직무의 의사결정 문제로 만든다. 기본은 공학 계산이 아니라 상황 판단·우선순위·이해관계자 설득·규정과 절차 판단 중심이다.
- 참고자료는 반드시 2개. 각 자료에 표(항목·값·비고)가 들어가야 하고, 서로 다른 각도(예: 자료1 현상·기록, 자료2 기준·대안·일정·비용)를 다룬다.
- 숫자는 표에서 한눈에 읽히는 수준으로 두고, 단위 환산이나 다단계 계산을 요구하지 않는다. 수치는 서로 모순되지 않게 넣는다.
- 자료 안에 반드시 판단 함정 2~3개를 심는다: 일정·현장 현실 무시, 징계·형식주의 편향, 질문·조건 누락(측정 항목·이해관계자), 개인정보·절차 위반 등.
- 실제 존재하는 법령·제도만 언급하고, 불확실하면 "사내 기준"처럼 일반화한다.
- mission은 "3,000자 이내로 ~ 보고서를 작성하시오" 형태. constraints는 3~4개.
- difficulty는 "입문"·"보통"·"심화" 중 하나.
- modelAnswer에는 실제 제출용 두괄식 보고서(report, 900~1,400자), 왜 그렇게 결론했는지 3개(points), 이 과제에서 외부 AI에게 할 질문 예시 2~3개(samplePrompts)를 넣는다.
- content 안에서는 마크다운 표를 써도 된다.
- 출력은 코드펜스 없이 JSON만. 한국어.

[JSON 형식]
{
  "title": "과제 제목",
  "field": "보건",
  "difficulty": "보통",
  "background": "과제 배경 3~5문장",
  "mission": "미션 문장",
  "constraints": ["조건1", "조건2", "조건3"],
  "resources": [
    { "label": "자료 1", "title": "자료 제목.pdf", "summary": "한 줄 요지", "content": "본문 + 마크다운 표" },
    { "label": "자료 2", "title": "자료 제목.pdf", "summary": "한 줄 요지", "content": "본문 + 마크다운 표" }
  ],
  "traps": [
    { "title": "함정 제목", "detail": "무엇이 함정이고 어떻게 읽어야 하는지", "keywords": ["키워드1", "키워드2"] }
  ],
  "modelAnswer": {
    "report": "결론 먼저 → 근거와 대가 → 실행계획 순서의 실제 제출용 보고서",
    "points": ["설계 포인트 1", "설계 포인트 2", "설계 포인트 3"],
    "samplePrompts": ["이렇게 물어보면 좋은 예시 1", "예시 2"]
  }
}

[주제]
(여기에 만들고 싶은 주제를 적으세요. 예: 협력업체가 MSDS 없는 세정제를 반입했을 때)
`
