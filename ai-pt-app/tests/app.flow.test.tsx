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

function text(): string {
  return container.textContent ?? ''
}

function findButton(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(button =>
    (button.textContent ?? '').includes(label),
  )
  if (!found) throw new Error(`버튼을 찾지 못함: ${label}`)
  return found as HTMLButtonElement
}

function setValue(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

async function renderApp() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<App />)
  })
}

beforeEach(async () => {
  localStorage.clear()
  await renderApp()
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
})

describe('앱 기본 화면', () => {
  it('제목·과제 1·세 패널이 렌더된다', () => {
    expect(text()).toContain('SK하이닉스 문제해결 PT 연습실')
    expect(text()).toContain(BUILTIN_SCENARIOS[0].title)
    expect(text()).toContain('문제 지문')
    expect(text()).toContain('답안 작성')
    expect(text()).toContain('AI Agent')
    expect(text()).toContain('35:00')
  })

  it('답안을 입력하면 실시간 글자수가 바뀐다', async () => {
    const editor = container.querySelector('.answer-editor') as HTMLTextAreaElement
    expect(editor).toBeTruthy()
    await act(async () => {
      setValue(editor, '테스트 답안입니다')
    })
    expect(text()).toContain('9 / 3,000자')
  })

  it('3,000자를 넘으면 경고와 제출 비활성화가 나타난다', async () => {
    const editor = container.querySelector('.answer-editor') as HTMLTextAreaElement
    await act(async () => {
      setValue(editor, '가'.repeat(3010))
    })
    expect(text()).toContain('3,000자를 10자 초과')
    const submit = findButton('최종 제출 및 AI 채점')
    expect(submit.disabled).toBe(true)
  })

  it('뼈대 삽입 버튼이 5개 섹션 틀을 넣는다', async () => {
    await act(async () => {
      findButton('뼈대 삽입').click()
    })
    const editor = container.querySelector('.answer-editor') as HTMLTextAreaElement
    expect(editor.value).toContain('[결론 요약]')
    expect(editor.value).toContain('[리스크·실행계획]')
  })

  it('타이머를 시작하면 일시정지로 바뀐다', async () => {
    await act(async () => {
      findButton('▶ 시작').click()
    })
    expect(text()).toContain('일시정지')
  })
})

describe('과제 전환 · 참고자료 뷰어', () => {
  it('과제를 바꾸면 지문과 제목이 교체된다', async () => {
    await act(async () => {
      container.querySelector('.scenario-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(text()).toContain('과제 선택')
    await act(async () => {
      const target = Array.from(container.querySelectorAll('button')).find(button =>
        (button.textContent ?? '').includes(BUILTIN_SCENARIOS[1].title),
      )
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(text()).toContain(BUILTIN_SCENARIOS[1].title)
    expect(text()).toContain('MSDS')
  })

  it('난이도 필터로 입문·심화 과제만 걸러 볼 수 있다', async () => {
    await act(async () => {
      container.querySelector('.scenario-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelectorAll('.scenario-list .scenario-row')).toHaveLength(BUILTIN_SCENARIOS.length)

    await act(async () => {
      findButton('심화').click()
    })
    expect(container.querySelectorAll('.scenario-list .scenario-row')).toHaveLength(4)

    await act(async () => {
      findButton('입문').click()
    })
    expect(container.querySelectorAll('.scenario-list .scenario-row')).toHaveLength(6)
    expect(text()).toContain('야간조 두통·불면 민원 5건')
  })

  it('과제를 시작하지 않아도 📖 모범답안 시트를 열어 읽을 수 있다', async () => {
    await act(async () => {
      container.querySelector('.scenario-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      findButton('📖 모범답안').click()
    })
    expect(text()).toContain('제출용 보고서')
    expect(text()).toContain('핵심 설계 포인트')
    expect(text()).toContain('추천 AI 질문')
    expect(container.querySelector('.model-answer-report')?.textContent?.length ?? 0).toBeGreaterThan(800)
  })

  it('자료 버튼을 누르면 표가 있는 모달이 열리고 탭을 전환할 수 있다', async () => {
    await act(async () => {
      container.querySelector('.resource-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('.res-table')).toBeTruthy()
    const rows = container.querySelectorAll('.res-table tbody tr')
    expect(rows.length).toBeGreaterThan(2)

    const tab2 = Array.from(container.querySelectorAll('.tabs .tab')).find(tab =>
      (tab.textContent ?? '').includes('자료 2'),
    )
    await act(async () => {
      tab2?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(text()).toContain('국소배기')
    expect(findButton('자료 텍스트 복사')).toBeTruthy()
  })
})

describe('AI 채팅 (데모)', () => {
  it('넓은 요청에는 데모 응답과 코치 팁이 붙는다', async () => {
    const input = container.querySelector('.chat-input-area textarea') as HTMLTextAreaElement
    await act(async () => {
      setValue(input, '보고서 다 써줘')
    })
    await act(async () => {
      findButton('전송').click()
      await new Promise(resolve => setTimeout(resolve, 700))
    })
    expect(text()).toContain('데모 응답')
    expect(text()).toContain('코치')
    expect(text()).toContain('일반적으로')
  })

  it('좁은 질문에는 자료 기반 계산 응답이 온다', async () => {
    const input = container.querySelector('.chat-input-area textarea') as HTMLTextAreaElement
    await act(async () => {
      setValue(input, '표 2에서 사내 기준을 넘은 시간대만 골라 표로 보여 줘')
    })
    await act(async () => {
      findButton('전송').click()
      await new Promise(resolve => setTimeout(resolve, 700))
    })
    expect(text()).toContain('1,620')
  })
})

describe('제출 후 피드백', () => {
  it('답안을 제출하면 100점 채점 리포트·함정·꼬리질문·발표 뼈대가 나온다', async () => {
    const editor = container.querySelector('.answer-editor') as HTMLTextAreaElement
    await act(async () => {
      setValue(
        editor,
        '결론적으로 댐퍼를 원복하고 조건부 가동합니다. 미스트 필터는 10/28 교체되어 정상입니다. 제어풍속 0.38 m/s는 기준 0.50의 76%입니다. 톨루엔 STEL 118 ppm은 기준 100 ppm을 초과합니다. 오늘 PM으로 댐퍼를 원복합니다.',
      )
    })
    await act(async () => {
      findButton('최종 제출 및 AI 채점').click()
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    expect(text()).toContain('숨은 함정 탐지 리포트')
    expect(text()).toContain('예상 압박 꼬리질문 4개')
    expect(text()).toContain('1분 30초 발표 뼈대')
    expect(text()).toContain('로컬 채점(데모)')
    expect(text()).toContain('결론 먼저')
    expect(text()).toContain('모범답안 & 추천 AI 질문')

    const history = JSON.parse(localStorage.getItem('aipt_history_v1') ?? '[]') as unknown[]
    expect(history.length).toBe(1)
  })

  it('꼬리질문 리허설에 방어 답변을 쓰면 3줄 코칭이 붙는다', async () => {
    const editor = container.querySelector('.answer-editor') as HTMLTextAreaElement
    await act(async () => {
      setValue(editor, '결론적으로 조건부 가동합니다. 자료 1의 제어풍속 0.38 m/s 때문에 댐퍼를 원복해야 합니다.')
    })
    await act(async () => {
      findButton('최종 제출 및 AI 채점').click()
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    const rehearseBtn = findButton('내 방어 답변 써보고 피드백 받기')
    await act(async () => {
      rehearseBtn.click()
    })
    const box = container.querySelector('.rehearsal-box textarea') as HTMLTextAreaElement
    expect(box).toBeTruthy()
    await act(async () => {
      setValue(box, '댐퍼가 15도 닫혀 있었기 때문입니다. 자료 1에 11/05 조정 이력이 있습니다.')
    })
    await act(async () => {
      findButton('피드백 받기').click()
      await new Promise(resolve => setTimeout(resolve, 500))
    })
    expect(text()).toContain('자료 근거')
    expect(text()).toContain('놓친 리스크')
  })
})

describe('새 과제 추가 (JSON)', () => {
  const custom = {
    title: '테스트용 신규 과제 — TMAH 누출 대응',
    field: '보건',
    background: '클린룸 세정 라인에서 TMAH 용액을 사용한다. 배관 교체가 3일 뒤 예정되어 있다.',
    mission: '3,000자 이내로 누출 대응과 작업 재개 판단을 담은 보고서를 작성하시오.',
    constraints: ['답안 3,000자 이내', '결론 먼저'],
    resources: [
      {
        label: '자료 1',
        title: 'TMAH 물성.pdf',
        summary: '노출기준과 건강영향',
        content: 'TMAH는 피부 흡수 위험이 있다.\n\n| 항목 | 값 |\n| --- | --- |\n| TWA | 0.5 ppm |\n| pH | 13.5 |',
      },
      {
        label: '자료 2',
        title: '공정 일정.pdf',
        summary: '대안 비교',
        content: '| 대안 | 기간 | 비용 |\n| --- | --- | --- |\n| A 즉시 교체 | 2일 | 0.3억 |\n| B 임시 보수 | 4시간 | 0.05억 |',
      },
    ],
    traps: [{ title: 'ppm과 %를 혼동', detail: '2.38% 용액과 0.5 ppm 기준을 같은 단위로 비교하면 안 된다.', keywords: ['ppm', '2.38%'] }],
  }

  it('코드펜스 JSON을 붙여 넣고 저장하면 내 과제로 추가된다', async () => {
    await act(async () => {
      container.querySelector('.scenario-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      findButton('+ 새 과제 추가').click()
    })
    await act(async () => {
      findButton('② JSON 붙여넣기').click()
    })
    const area = container.querySelector('#ns-json') as HTMLTextAreaElement
    await act(async () => {
      setValue(area, '```json\n' + JSON.stringify(custom) + '\n```')
    })
    await act(async () => {
      findButton('검증하고 미리보기').click()
    })
    expect(text()).toContain('미리보기')
    expect(text()).toContain('테스트용 신규 과제')

    await act(async () => {
      findButton('저장하고 이 과제로 연습').click()
      await new Promise(resolve => setTimeout(resolve, 30))
    })
    expect(text()).toContain('테스트용 신규 과제 — TMAH 누출 대응')
    const stored = JSON.parse(localStorage.getItem('pt_custom_scenarios_v1') ?? '{}') as { scenarios?: unknown[] }
    expect(stored.scenarios?.length).toBe(1)
  })

  it('필수 필드가 빠진 JSON은 오류를 보여 주고 저장 버튼이 잠긴다', async () => {
    await act(async () => {
      container.querySelector('.scenario-pick')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      findButton('+ 새 과제 추가').click()
    })
    await act(async () => {
      findButton('② JSON 붙여넣기').click()
    })
    const area = container.querySelector('#ns-json') as HTMLTextAreaElement
    await act(async () => {
      setValue(area, JSON.stringify({ title: '빈 과제' }))
    })
    await act(async () => {
      findButton('검증하고 미리보기').click()
    })
    expect(text()).toContain('고칠 점이 있습니다')
    expect(findButton('저장하고 이 과제로 연습').disabled).toBe(true)
  })
})

describe('설정', () => {
  it('API 키를 입력하면 이 PC 저장소에 남는다', async () => {
    await act(async () => {
      findButton('⚙ 설정').click()
    })
    const keyInput = container.querySelector('#api-key') as HTMLInputElement
    expect(keyInput).toBeTruthy()
    await act(async () => {
      setValue(keyInput, 'AIzaTESTKEY1234567890123456789012345')
    })
    const saved = JSON.parse(localStorage.getItem('aipt_settings_v1') ?? '{}') as { apiKey?: string }
    expect(saved.apiKey).toContain('AIzaTESTKEY')
    expect(text()).toContain('Flash-Lite')
  })
})
