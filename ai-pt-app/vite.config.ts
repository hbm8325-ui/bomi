import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base: './' — 파일 경로 하위에서도 그대로 동작합니다(로컬 서버·정적 호스팅 공용).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      // 이 샌드박스에는 /etc/hosts가 없어 'localhost' 해석이 실패합니다. 127.0.0.1로 고정합니다.
      jsdom: { url: 'http://127.0.0.1:3000/' },
    },
    include: ['tests/**/*.test.{ts,tsx}'],
    globals: false,
  },
})
