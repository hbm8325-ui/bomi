import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base: './' 이므로 GitHub Pages 하위 경로(https://<user>.github.io/<repo>/)에서도 그대로 동작합니다.
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
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
