import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src', 'tests', 'index.html']
// 공개 저장소 자체에 개인 식별 문자열이 남지 않도록 코드포인트·분절 조합으로 만든다.
const cp = (...codes: number[]) => String.fromCodePoint(...codes)
const NEEDLES = [
  cp(0xd55c, 0xbcf4, 0xbbf8), // 이름
  cp(0xc0bc, 0xc131) + 'SDI', // 소속
  ['01', '0-'].join(''), // 전화번호 접두
  ['bom2', '_h'].join(''), // 계정 핸들
  ['bomi', '929'].join(''), // 메일 아이디
  ['5236', '-8325'].join(''), // 전화번호 뒷자리
  ['hbm', '8325'].join(''), // 계정 아이디
]

const walk = (path: string): string[] => {
  const stat = statSync(path)
  if (stat.isFile()) return [path]
  return readdirSync(path).flatMap(name => walk(join(path, name)))
}

describe('개인정보 0건', () => {
  it('소스와 테스트에 개인 식별 정보가 들어 있지 않다', () => {
    const files = ROOTS.flatMap(root => walk(root)).filter(file => !file.endsWith('privacy.test.ts'))
    expect(files.length).toBeGreaterThan(10)
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const needle of NEEDLES) {
        expect(text.includes(needle), `${file} 에 '${needle}'`).toBe(false)
      }
    }
  })
})
