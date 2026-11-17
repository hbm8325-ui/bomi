// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const wait = async (ms: number) => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms))
  })
}

const findButton = (label: string): HTMLButtonElement => {
  const buttons = [...document.querySelectorAll('button')]
  const found = buttons.find(button => (button.textContent ?? '').trim().includes(label))
  if (!found) throw new Error(`버튼을 찾지 못했습니다: ${label}`)
  return found as HTMLButtonElement
}

const click = async (label: string) => {
  await act(async () => {
    findButton(label).click()
  })
}

const typeInto = async (element: HTMLTextAreaElement, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const send = async (text: string) => {
  const textarea = document.querySelector('textarea.composer-input') as HTMLTextAreaElement
  expect(textarea).toBeTruthy()
  await typeInto(textarea, text)
  await act(async () => {
    ;(document.querySelector('button.send-button') as HTMLButtonElement).click()
  })
}

describe('앱 흐름 (데모 모드 · 4단계 그룹 토의)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    Element.prototype.scrollTo = () => {}
    window.confirm = () => true
  })

  beforeEach(async () => {
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<App />)
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('시작하면 1단계 준비 화면이 먼저 나오고 AI는 아직 말하지 않는다', async () => {
    expect(container.textContent).toContain('세 명의 팀원과')

    await click('랜덤 주제')
    await click('4단계 토의 시작하기')

    expect(container.textContent).toContain('1단계 · 개인 의견 준비')
    expect(container.textContent).toContain('내 의견 메모')
    expect(container.textContent).toContain('05:00')
    expect(container.querySelectorAll('.ai-bubble').length).toBe(0)
  }, 20000)

  it('1차 토의를 시작하면 AI 팀원이 데모 발언으로 토의를 연다', async () => {
    await click('랜덤 주제')
    await click('4단계 토의 시작하기')
    await click('1차 토의 시작하기')

    await wait(1400)
    expect(container.querySelectorAll('.ai-bubble').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelector('.bubble-tag')?.textContent).toBe('데모')
    expect(container.textContent).toContain('2단계')
  }, 20000)

  it('내 발언을 보내면 팀원이 이어서 답하고 시간 안내가 보인다', async () => {
    await click('랜덤 주제')
    await click('4단계 토의 시작하기')
    await click('1차 토의 시작하기')
    await wait(1200)

    const composer = container.querySelector('textarea.composer-input') as HTMLTextAreaElement
    await typeInto(composer, '저는 기준을 먼저 정하고 예외를 나중에 정하는 방식이 좋다고 봅니다.')
    expect(container.querySelector('.speak-timing')?.textContent).toContain('분량')
    await act(async () => {
      ;(container.querySelector('button.send-button') as HTMLButtonElement).click()
    })
    expect(container.querySelectorAll('.user-bubble').length).toBe(1)

    await wait(1500)
    expect(container.querySelectorAll('.ai-bubble').length).toBeGreaterThanOrEqual(2)
  }, 20000)

  it('3단계 추가 관점 → 4단계 결과물 → 피드백·꼬리질문까지 이어진다', async () => {
    await click('랜덤 주제')
    await click('4단계 토의 시작하기')

    const memo = container.querySelector('textarea.text-area') as HTMLTextAreaElement
    await typeInto(memo, '치료 목적과 편의 목적을 나눠서 판단해야 합니다.')
    await click('1차 토의 시작하기')
    await wait(1200)

    await send('저는 목적별로 검증 주체를 나누는 기준을 제안합니다. 서연 님은 어떻게 보세요?')
    await wait(1300)

    await click('다음 단계로')
    expect(container.textContent).toContain('추가 관점')
    expect(container.textContent).toContain('3단계')
    await wait(1600)
    expect(container.querySelectorAll('.ai-bubble').length).toBeGreaterThanOrEqual(2)

    await click('다음 단계로')
    expect(container.textContent).toContain('4단계 · 공동 결과물 작성')
    expect(container.textContent).toContain('우리 조의 합의안')

    await click('✨ AI 팀원과 초안 만들기')
    await wait(400)
    expect(container.textContent).toContain('팀원이 제안한 초안')
    await click('이 초안을 에디터에 반영')
    const editor = container.querySelector('textarea.joint-textarea') as HTMLTextAreaElement
    expect(editor.value).toContain('[1. 우리 조의 합의 방향')

    await click('토의 종료 및 피드백 받기')
    await wait(500)

    expect(container.textContent).toContain('다섯 가지 기준')
    expect(container.textContent).toContain('관점 수용·조율')
    expect(container.textContent).toContain('토의·결과물 기여')
    expect(container.textContent).toContain('예상 꼬리질문')
    expect(container.querySelectorAll('.followup-card').length).toBe(3)
    expect(container.querySelector('.score-ring-label strong')?.textContent).not.toBe('–')

    const stored = JSON.parse(window.localStorage.getItem('hd_history_v1') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].jointDeliverable).toContain('[1.')
    expect(stored[0].prepNotes.position).toContain('치료 목적')
    expect(stored[0].additionalPerspective.length).toBeGreaterThan(20)
    expect(stored[0].feedback.followUps).toHaveLength(3)

    await click('과거 기록')
    expect(container.textContent).toContain('지난 토의 1개')
  }, 30000)

  it('새 필드가 없는 예전 기록도 그대로 열린다', async () => {
    const legacy = [
      {
        id: 'hd_legacy_1',
        topicId: 'ai-decision',
        topicTitle: '사람보다 정확한 AI에게 최종 결정도 맡겨도 될까?',
        category: 'AI와 윤리',
        mode: 'basic',
        model: null,
        startedAt: 1700000000000,
        endedAt: 1700000600000,
        messages: [
          { id: 'l1', speakerId: 'user', text: '저는 사람이 최종 결정을 해야 합니다.', turnId: 1, timestamp: 1700000000000, isUser: true, source: 'text' },
          { id: 'l2', speakerId: 'ai1', text: '기준을 나누면 좋겠습니다.', turnId: 2, timestamp: 1700000001000, isUser: false, source: 'real' },
        ],
        feedback: null,
      },
    ]
    await act(async () => {
      window.localStorage.setItem('hd_history_v1', JSON.stringify(legacy))
      root.unmount()
    })
    container.remove()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<App />)
    })
    await click('기록')
    expect(container.textContent).toContain('지난 토의 1개')
    await click('사람보다 정확한 AI에게')
    expect(container.textContent).toContain('저는 사람이 최종 결정을 해야 합니다.')
    expect(container.textContent).toContain('저장된 피드백이 없습니다')
  }, 20000)
})
