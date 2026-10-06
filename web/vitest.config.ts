import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // pure TypeScript, no Nuxt
      { test: { name: 'engine', include: ['engine/**/*.test.ts', 'build/**/*.test.ts', 'server/**/*.test.ts'], environment: 'node' } },
      // components and composables inside a Nuxt runtime (happy-dom)
      await defineVitestProject({ test: { name: 'app', include: ['test/**/*.test.ts'], environment: 'nuxt' } }),
    ],
  },
})
