// 로컬 샌드박스에는 /etc/hosts가 없어 jsdom이 'localhost'를 찾지 못합니다.
// 이 래퍼는 DNS 우회 모듈을 NODE_OPTIONS로 넣고 vitest를 실행합니다(일반 PC에서는 무해).
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const bin = path.join(here, '..', 'node_modules', 'vitest', 'vitest.mjs')
const shim = path.join(here, 'localhost-dns-shim.cjs')
const nodeOptions = [process.env.NODE_OPTIONS, `--require=${shim}`].filter(Boolean).join(' ')

const child = spawn(process.execPath, [bin, 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
})

child.on('exit', code => process.exit(code ?? 1))
