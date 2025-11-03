import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = __dirname

export default defineConfig({
  resolve: {
    alias: {
      '@/': root + '/',
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['tests/setup/test-setup.ts'],
    cache: { dir: './node_modules/.vitest' },
  },
})

