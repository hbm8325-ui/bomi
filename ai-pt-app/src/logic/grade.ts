import type { ChatMessage, FollowUp, GradeResult, ScoreItem, ScoreItemKey, Scenario, TrapFinding } from '../types'
import { SCORE_LABELS, SCORE_MAX } from './prompts'
import { scenarioNumbers } from '../data/scenarios'
import { classifyPrompt } from './coach'
import { normalizeNumber } from './text'

const KEYS: ScoreItemKey[] = ['problem', 'prompt', 'domain', 'structure']

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function asStringArray(value: unknown, max = 4): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => asString(item))
    .filter(Boolean)
    .slice(0, max)
}

type RawItem = { key?: unknown; score?: unknown; comment?: unknown; evidence?: unknown }

/** Gemini/데모가 돌려준 채점 JSON을 화면이 믿을 수 있는 형태로 정규화합니다. */
export function normalizeGrade(raw: unknown, scenario: Scenario, answer = '', chat: ChatMessage[] = []): GradeResult {
  const source = (raw ?? {}) as Record<string, unknown>
  const rawItems = Array.isArray(source.items) ? (source.items as RawItem[]) : []
  const items: ScoreItem[] = KEYS.map(key => {
    const found = rawItems.find(item => asString(item?.key) === key)
    const max = SCORE_MAX[key]
    return {
      key,
      label: SCORE_LABELS[key],
      max,
      score: round1(clamp(Number(found?.score ?? 0), 0, max)),
      comment: asString(found?.comment, '코멘트가 제공되지 않았습니다.'),
      evidence: asString(found?.evidence),
    }
  })

  const rawTraps = Array.isArray(source.traps) ? (source.traps as Record<string, unknown>[]) : []
  const traps: TrapFinding[] = scenario.traps.map((trap, index) => {
    const byTitle = rawTraps.find(item => asString(item?.title).includes(trap.title.slice(0, 10)))
    const byIndex = rawTraps[index]
    const found = byTitle ?? byIndex
    return {
      title: trap.title,
      found: Boolean(found?.found),
      evidence: asString(found?.evidence),
    }
  })

  const rawFollowUps = Array.isArray(source.followUps) ? (source.followUps as Record<string, unknown>[]) : []
  const followUps: FollowUp[] = rawFollowUps
    .map(item => ({
      question: asString(item?.question),
      intent: asString(item?.intent, '지원자의 판단 근거 확인'),
      points: asStringArray(item?.points, 4),
      quote: asString(item?.quote),
    }))
    .filter(item => item.question)

  const presentationRaw = (source.presentation ?? {}) as Record<string, unknown>
  const sentences = splitSentences(answer)
  const presentation = {
    hook: asString(presentationRaw.hook, sentences[0] ?? ''),
    frame: asString(presentationRaw.frame, sentences[1] ?? ''),
    solution: asString(presentationRaw.solution, sentences.slice(2, 5).join(' ')),
    close: asString(presentationRaw.close, sentences[sentences.length - 1] ?? ''),
  }

  const total = round1(items.reduce((sum, item) => sum + item.score, 0))

  return {
    total,
    items,
    overall: asString(source.overall, '총평이 제공되지 않았습니다.'),
    strengths: asStringArray(source.strengths, 3),
    improvements: asStringArray(source.improvements, 3),
    traps,
    followUps: ensureFollowUps(scenario, followUps, answer, chat),
    presentation,
  }
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+|(?<=다\.)\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 3)
}

export function firstQuote(answer: string, chat: ChatMessage[]): string {
  const sentences = splitSentences(answer)
  const candidate = sentences.find(s => s.length >= 10)
  if (candidate) return candidate.slice(0, 80)
  const userMsg = chat.find(m => m.role === 'user' && m.text.trim().length > 3)
  return userMsg ? userMsg.text.slice(0, 80) : ''
}

/** 꼬리질문이 4개보다 적거나 없을 때 과제 함정·로그로 채웁니다. */
export function ensureFollowUps(scenario: Scenario, followUps: FollowUp[], answer: string, chat: ChatMessage[]): FollowUp[] {
  const out = [...followUps].slice(0, 4)
  const quote = firstQuote(answer, chat)
  const firstQuestion = chat.find(m => m.role === 'user')?.text ?? ''
  const templates: FollowUp[] = [
    {
      question: quote
        ? `보고서에서 "${quote}"라고 쓰셨습니다. 이 결론을 뒤집을 수 있는 자료상의 근거는 무엇까지 확인하셨나요?`
        : '제출하신 결론의 근거가 된 자료 수치를 두 개만 말씀해 주시겠습니까?',
      intent: '결론과 근거의 연결 검증',
      points: [
        '결론을 먼저 한 문장으로 반복한 뒤, 근거 표의 수치를 정확히 인용',
        '반대 근거를 알고 있었다는 점을 보여주고, 그럼에도 이 결론을 택한 이유를 제시',
        '자료에 없는 값은 추정이 아니라 "자료 없음"으로 구분했다고 밝히기',
      ],
      quote,
    },
    {
      question: `${scenario.traps[0]?.title ?? '자료의 단위와 평균값'} — 이 부분을 검토하셨습니까? 보고서에 반영하지 않았다면 이유가 있습니까?`,
      intent: '함정(단위·평균·측정 누락) 인지 확인',
      points: [
        scenario.traps[0]?.detail?.slice(0, 90) ?? '단위 혼재를 환산 가정과 함께 밝혔는지 확인',
        '반영하지 못했다면 면접 자리에서 정정하는 태도가 감점을 줄임',
      ],
      quote: '',
    },
    {
      question: '제시한 대안의 비용·가동률·일정은 어떤 가정으로 계산하셨습니까? 그 가정이 틀리면 결론은 어떻게 바뀝니까?',
      intent: '현실성(비용·일정)과 조건부 사고 검증',
      points: [
        '자료 값과 가정을 분리해서 말하기(예: "자료의 0.18억 원은 5일 기준")',
        '가정이 틀릴 경우의 대안을 미리 준비(계획 B)',
        '의사결정권자가 오늘 승인할 수 있는 형태로 마무리',
      ],
      quote: '',
    },
    {
      question: firstQuestion
        ? `AI에게 "${firstQuestion.slice(0, 60)}"라고 물으셨습니다. AI 답변 중 어느 부분을 그대로 인용했고, 어느 부분은 검증 후 버리셨습니까?`
        : 'AI를 사용하지 않으셨다면, 자료에서 직접 확인한 수치와 해석을 구분해 설명해 주시겠습니까?',
      intent: 'AI 활용의 검증 책임 확인',
      points: [
        '질문의 범위를 좁힌 이유를 설명',
        'AI가 준 값과 원문 자료를 대조한 절차를 구체적으로 제시',
        'AI가 만든 근거를 그대로 쓰지 않았다는 점을 사례로 보여주기',
      ],
      quote: firstQuestion.slice(0, 60),
    },
  ]
  for (const template of templates) {
    if (out.length >= 4) break
    if (!out.some(item => item.question === template.question)) out.push(template)
  }
  return out.slice(0, 4)
}

/** ------------------------------ 데모 채점(로컬 휴리스틱) ------------------------------ */

const KEYWORDS = {
  problem: ['결정', '쟁점', '우선순위', '범위', '원인', '노출', '기준', '문제', '리스크', '판단'],
  domain: ['법', '기준', '노출기준', '국소배기', '환기', '호흡보호구', '보호구', '대체', '건강진단', '밀폐', '측정', '환산'],
  reality: ['비용', '가동률', '일정', '투자', '억', '기간', '손실', '잔여', '단계'],
  structure: ['결론', '요약', '제안', '실행', '조치', '계획'],
}

function countHits(text: string, words: string[]): number {
  return words.reduce((sum, word) => (text.includes(word) ? sum + 1 : sum), 0)
}

export function demoGrade(scenario: Scenario, answer: string, chat: ChatMessage[]): GradeResult {
  const text = answer.trim()
  const chars = Array.from(text).length
  const userMsgs = chat.filter(m => m.role === 'user')
  const verdicts = userMsgs.map(m => classifyPrompt(m.text))
  const targeted = verdicts.filter(v => v.kind === 'targeted')
  const broad = verdicts.filter(v => v.kind === 'broad')

  const numbers = scenarioNumbers(scenario)
  const cited = numbers.filter(num => text.includes(num) || text.includes(normalizeNumber(num))).length
  const resourceHits = countHits(text, KEYWORDS.domain)
  const problemHits = countHits(text, KEYWORDS.problem)
  const realityHits = countHits(text, KEYWORDS.reality)
  const structureHits = countHits(text, KEYWORDS.structure)
  const firstBlock = text.slice(0, 160)
  const conclusionFirst = /결론|요약|제안|따라서|우선/.test(firstBlock)
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 20).length

  const problem = clamp(
    6 + Math.min(problemHits, 6) * 2 + (conclusionFirst ? 3 : 0) + (chars >= 800 ? 3 : 0) + (cited > 2 ? 3 : 0),
    0,
    25,
  )
  const promptScore = clamp(
    5 + targeted.length * 5 - broad.length * 4 + (userMsgs.length >= 3 ? 3 : 0) + (cited > 0 ? 3 : 0),
    0,
    30,
  )
  const domain = clamp(7 + Math.min(cited, 8) + Math.min(resourceHits, 6) + Math.min(realityHits, 4), 0, 25)
  const structure = clamp(
    5 + (conclusionFirst ? 4 : 0) + Math.min(paragraphs, 4) + (chars >= 1200 && chars <= 3000 ? 3 : 0) + (structureHits >= 3 ? 3 : 0),
    0,
    20,
  )

  const scores: Record<ScoreItemKey, number> = { problem, prompt: promptScore, domain, structure }
  const items: ScoreItem[] = KEYS.map(key => ({
    key,
    label: SCORE_LABELS[key],
    max: SCORE_MAX[key],
    score: round1(scores[key]),
    comment: demoItemComment(key, { chars, cited, targeted: targeted.length, broad: broad.length, conclusionFirst, paragraphs }),
    evidence: key === 'prompt' ? (targeted[0]?.reason ?? userMsgs[0]?.text.slice(0, 60) ?? '') : '',
  }))

  const searchText = `${text}\n${chatLogJoined(chat)}`
  const traps: TrapFinding[] = scenario.traps.map(trap => {
    const hits = trap.keywords.filter(keyword => searchText.includes(keyword))
    return {
      title: trap.title,
      found: hits.length >= 2,
      evidence: hits.length ? `언급: ${hits.slice(0, 3).join(', ')}` : '답안·로그에서 확인되지 않음',
    }
  })

  const total = round1(items.reduce((sum, item) => sum + item.score, 0))
  const foundCount = traps.filter(t => t.found).length

  return {
    total,
    items,
    overall: `로컬 채점(데모) 결과입니다. 답안 ${chars.toLocaleString()}자, AI 질문 ${userMsgs.length}회(좁은 질문 ${targeted.length}·넓은 요청 ${broad.length}), 자료 수치 인용 ${cited}개, 함정 ${foundCount}/${traps.length}개를 짚었습니다. 실제 Gemini 채점에서는 문장 단위 근거 평가가 추가됩니다.`,
    strengths: [
      cited > 2 ? `자료 수치를 ${cited}개 인용해 주장을 뒷받침했습니다.` : '과제의 결론을 제시하려는 구조가 보입니다.',
      targeted.length ? `좁고 검증 가능한 질문을 ${targeted.length}회 사용했습니다.` : '제한시간 안에 답안을 완성했습니다.',
      conclusionFirst ? '첫 문단에 결론을 배치했습니다.' : '문제 정의를 서술했습니다.',
    ],
    improvements: [
      cited <= 2 ? '자료의 구체 수치(예: 제어풍속·기준 대비 %)를 본문에 직접 인용하세요.' : '인용한 수치의 출처 표를 함께 밝히면 신뢰도가 올라갑니다.',
      broad.length ? `넓은 요청 ${broad.length}건은 감점 요인입니다. 표·수치를 지정한 좁은 질문으로 바꾸세요.` : '질문 로그가 적습니다. 최소 3회는 자료 대조 질문을 남기세요.',
      `놓친 함정 ${traps.length - foundCount}개를 보고서에 반영할 여지가 있습니다.`,
    ],
    traps,
    followUps: ensureFollowUps(scenario, [], text, chat),
    presentation: buildDemoPresentation(text),
    demo: true,
    at: Date.now(),
  }
}

function chatLogJoined(chat: ChatMessage[]): string {
  return chat.map(m => m.text).join('\n')
}

function demoItemComment(
  key: ScoreItemKey,
  stat: { chars: number; cited: number; targeted: number; broad: number; conclusionFirst: boolean; paragraphs: number },
): string {
  if (key === 'problem') {
    return stat.conclusionFirst
      ? '문제를 먼저 정의하고 결론을 앞에 둔 점이 좋습니다. 다만 결정해야 할 변수(무엇을 정하는지)를 한 문장으로 더 명확히 하면 좋습니다.'
      : '결론이 뒤쪽에 있습니다. 첫 문단에 "무엇을 결정할지 + 결론"을 먼저 쓰세요.'
  }
  if (key === 'prompt') {
    if (stat.targeted === 0) return '자료를 지목한 좁은 질문이 없습니다. "자료 1과 2의 수치를 비교표로" 같은 요청이 채점에 유리합니다.'
    if (stat.broad > 0) return `좁은 질문 ${stat.targeted}회는 가점, 넓은 요청 ${stat.broad}회는 감점입니다. AI 답을 그대로 옮기지 않았다는 근거를 본문에 남기세요.`
    return '자료 기반 질문을 사용했습니다. 질문 후 AI 답을 원문과 대조한 흔적(수치 재계산)을 남기면 더 좋습니다.'
  }
  if (key === 'domain') {
    return stat.cited >= 4
      ? '자료 수치를 근거로 사용했습니다. 법적 기준과 사내 기준을 구분해 표기하면 완성도가 올라갑니다.'
      : '보건 원칙(노출 저감 우선순위)과 현실 제약(가동률·비용)의 연결이 약합니다. 수치를 최소 3개 인용하세요.'
  }
  return stat.paragraphs >= 3
    ? '단락이 나뉘어 읽기 쉽습니다. 실행계획에 담당·시점을 붙이면 두괄식 보고서로 완성됩니다.'
    : '단락 구분이 거의 없습니다. 결론/근거/대가/실행계획 4단으로 나눠 쓰세요.'
}

function buildDemoPresentation(answer: string): GradeResult['presentation'] {
  const sentences = splitSentences(answer)
  const hook = sentences[0] ?? '이번 과제의 핵심은 노출 위험과 가동률의 균형입니다.'
  const frame = sentences[1] ?? '자료를 기준으로 결정해야 할 변수를 세 가지로 정리했습니다.'
  const solution = sentences.slice(2, 5).join(' ') || '가장 먼저 실행할 조치와 그 근거를 제시합니다.'
  const close = sentences[sentences.length - 1] ?? '이상으로 발표를 마치겠습니다.'
  return { hook, frame, solution, close }
}

/** 제출 없이 빈 답안으로 채점할 때의 최소 결과 */
export function emptyGrade(scenario: Scenario): GradeResult {
  return demoGrade(scenario, '', [])
}
