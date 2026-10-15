import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // pure TypeScript, no Nuxt: the build helpers and the server's checks
      { test: { name: 'node', include: ['build/**/*.test.ts', 'server/**/*.test.ts'], environment: 'node' } },
      // components and composables inside a Nuxt runtime (happy-dom)
      await defineVitestProject({ test: { name: 'app', include: ['test/**/*.test.ts'], environment: 'nuxt', setupFiles: ['test/setup.ts'] } }),
    ],
  },
})
