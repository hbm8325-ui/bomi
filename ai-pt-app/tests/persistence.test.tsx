import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from '../src/App'
import { BUILTIN_SCENARIOS } from '../src/data/scenarios'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

function setValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

async function mount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<App />)
  })
}

async function unmount() {
  await act(async () => {
    root.unmount()
  })
  container.remove()
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(async () => {
  if (root) await unmount()
})

describe('자동 저장 · 새로고침 복원', () => {
  it('초안·발표 메모가 다시 열어도 남아 있다', async () => {
    await mount()
    const editor = container.querySelector('.answer-editor') as HTMLTextAreaElement
    await act(async () => {
      setValue(editor, '결론적으로 C안을 권고합니다.')
      await new Promise(resolve => setTimeout(resolve, 700))
    })
    await unmount()
    await mount()

    const restored = container.querySelector('.answer-editor') as HTMLTextAreaElement
    expect(restored.value).toBe('결론적으로 C안을 권고합니다.')
    expect(container.textContent).toContain('자동 저장')
  })

  it('과제를 바꿔도 채팅 로그가 섞이지 않는다', async () => {
    await mount()
    const input = container.querySelector('.chat-input-area textarea') as HTMLTextAreaElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(input, '보고서 다 써줘')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const send = Array.from(container.querySelectorAll('button')).find(button =>
      (button.textContent ?? '').includes('전송'),
    ) as HTMLButtonElement
    await act(async () => {
      send.click()
      await new Promise(resolve => setTimeout(resolve, 700))
    })
    expect(container.textContent).toContain('일반적으로')

    await act(async () => {
      container.querySelector('.scenario-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      const target = Array.from(container.querySelectorAll('button')).find(button =>
        (button.textContent ?? '').includes(BUILTIN_SCENARIOS[1].title),
      )
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    // 새 과제의 채팅은 비어 있어야 하고, 이전 대화가 저장소에 덮어써지지 않아야 한다.
    expect(container.textContent).not.toContain('일반적으로')
    const storedB = localStorage.getItem(`aipt_chat_${BUILTIN_SCENARIOS[1].id}`)
    expect(storedB ?? '[]').not.toContain('일반적으로')
    const storedA = localStorage.getItem(`aipt_chat_${BUILTIN_SCENARIOS[0].id}`) ?? '[]'
    expect(storedA).toContain('일반적으로')
  })

  it('과제를 바꿔도 각 과제의 답안이 따로 보관된다', async () => {
    await mount()
    const editor = container.querySelector('.answer-editor') as HTMLTextAreaElement
    await act(async () => {
      setValue(editor, '과제 1 답안')
      await new Promise(resolve => setTimeout(resolve, 650))
    })
    await act(async () => {
      container.querySelector('.scenario-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      const target = Array.from(container.querySelectorAll('button')).find(button =>
        (button.textContent ?? '').includes(BUILTIN_SCENARIOS[1].title),
      )
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const second = container.querySelector('.answer-editor') as HTMLTextAreaElement
    expect(second.value).toBe('')
  })
})

describe('시간 종료 자동 제출', () => {
  it('00:00이 되면 자동으로 제출되어 피드백 화면으로 넘어간다', async () => {
    const scenarioId = BUILTIN_SCENARIOS[0].id
    localStorage.setItem(
      `aipt_timer_${scenarioId}`,
      JSON.stringify({ limit: 35, remaining: 2, running: true, endAt: Date.now() + 1500, startedAt: Date.now() - 2098500 }),
    )
    await mount()
    expect(container.textContent).not.toContain('00:00 · 공백 포함')

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 2600))
    })

    const text = container.textContent ?? ''
    expect(text).toContain('숨은 함정 탐지 리포트')
    expect(text).toContain('시간 종료 자동 제출')
    expect(text).toContain('00:00')

    const history = JSON.parse(localStorage.getItem('aipt_history_v1') ?? '[]') as { autoSubmitted?: boolean }[]
    expect(history).toHaveLength(1)
    expect(history[0].autoSubmitted).toBe(true)
  })
})
