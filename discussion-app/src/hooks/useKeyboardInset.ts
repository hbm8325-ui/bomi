import { useEffect } from 'react'

/**
 * iPhone Safari는 키보드가 열려도 100dvh를 줄이지 않습니다.
 * visualViewport 차이를 --kb 변수로 넘겨 입력창이 키보드에 가리지 않게 합니다.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const apply = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--kb', `${Math.round(inset)}px`)
    }
    apply()
    viewport.addEventListener('resize', apply)
    viewport.addEventListener('scroll', apply)
    return () => {
      viewport.removeEventListener('resize', apply)
      viewport.removeEventListener('scroll', apply)
      document.documentElement.style.setProperty('--kb', '0px')
    }
  }, [])
}
