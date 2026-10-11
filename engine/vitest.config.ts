import { defineConfig } from 'vitest/config'

// pure TypeScript, no Nuxt: the cwd is engine/, which the tests' readFileSync('charts/…') paths assume
export default defineConfig({ test: { name: 'engine', include: ['src/**/*.test.ts'], environment: 'node' } })
