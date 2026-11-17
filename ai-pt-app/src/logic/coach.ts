/** 지원자 프롬프트가 '넓은 요청'인지 '좁고 검증 가능한 요청'인지 판별합니다. */

export type PromptKind = 'broad' | 'targeted' | 'neutral'

export type PromptVerdict = {
  kind: PromptKind
  /** 0=넓음, 1=보통, 2=좁고 구체적 (채점 가점 방향) */
  score: number
  /** 연습 코치 ON일 때 붙는 팁 */
  tip?: string
  reason: string
}

const BROAD_PATTERNS: { re: RegExp; tip: string }[] = [
  {
    re: /(보고서|답안|전체|통째|처음부터|결론까지).{0,10}(써|작성|만들|정리)/,
    tip: "💡 보고서 통짜 요청은 채점에서 감점돼요. '자료 2의 A~D안을 가동률·비용·기간으로 비교표로 정리해 줘'처럼 한 표씩 좁혀 물어보세요.",
  },
  {
    re: /(해결책|대책|방안|어떻게\s*(해야|하면|할)|추천|조언|전략).{0,6}(줘|알려|말해|제시)?/,
    tip: "💡 '해결책 알려줘'는 원론만 돌아와요. '자료 1에서 OEL 미설정 물질만 골라 증기압 순으로 정리해 줘'처럼 대상을 지정해 보세요.",
  },
  {
    re: /(전체|전부|모두|다)\s*(요약|정리|알려)/,
    tip: "💡 전체 요약보다 '자료 2 표 3에서 비용 합계만 다시 계산해 줘'처럼 한 항목을 지목하면 채점에 쓸 근거가 남아요.",
  },
  {
    re: /^(요약해|정리해|알려줘|설명해)(\s*(줘|주세요))?$/,
    tip: "💡 무엇을 어떤 기준으로 볼지 정해 주세요. '톨루엔 STEL 초과 여부만 판단해 줘'처럼요.",
  },
]

const TARGETED_PATTERNS: RegExp[] = [
  /표\s*(로|형식|만들)/,
  /비교(표|해|해서|하)/,
  /환산/,
  /계산(해|해서|식|값|결과)/,
  /자료\s*[12１２]/,
  /자료에\s*없/,
  /자료\s*없음/,
  /수치/,
  /대조/,
  /몇\s*(ppm|mg|m\/s|억|건|명|%)/,
  /(차이|원인|이유)(는|가|를|좀)?\s*(뭐|무엇|알려|설명)/,
  /구간/,
  /기준\s*(대비|초과|미달)/,
  /(ppm|mg\/m³|mg\/m3|m\/s|mmHg|억\s*원|℃)/,
  /(정리|표시)(하|해)\s*(줘|주세요|고)/,
]

const RESOURCE_REF = /(자료|표|SDS|측정|물질|설비|대안|후보|공정|수치|기준)/

export function classifyPrompt(raw: string): PromptVerdict {
  const text = raw.trim()
  if (!text) return { kind: 'neutral', score: 1, reason: '빈 입력' }
  const chars = Array.from(text).length

  const targetedHits = TARGETED_PATTERNS.filter(re => re.test(text)).length
  const broadHit = BROAD_PATTERNS.find(p => p.re.test(text))

  // 숫자·단위를 직접 지정하고 자료를 지목하면 좁은 요청으로 본다.
  const specific = targetedHits >= 2 || (targetedHits >= 1 && /(자료\s*[12１２]|표\s*\d|ppm|mg\/m³|m\/s|mmHg|억\s*원)/.test(text))

  if (specific) {
    return {
      kind: 'targeted',
      score: 2,
      reason: `비교·수치·자료 지목 표현 ${targetedHits}개`,
    }
  }

  if (broadHit) {
    return { kind: 'broad', score: 0, tip: broadHit.tip, reason: '넓은 요청 패턴' }
  }

  if (chars < 30 && RESOURCE_REF.test(text)) {
    return {
      kind: 'neutral',
      score: 1,
      reason: '짧은 요청',
      tip: "💡 좋아요, 여기서 한 걸음 더: '어느 표의 어떤 값'인지 붙이면 AI 답이 검증 가능한 근거가 됩니다.",
    }
  }

  if (chars >= 120 && targetedHits >= 1) {
    return { kind: 'targeted', score: 2, reason: '구체적 조건 포함' }
  }

  return { kind: 'neutral', score: 1, reason: '판단 보류' }
}

export function isBroadPrompt(raw: string): boolean {
  return classifyPrompt(raw).kind === 'broad'
}
