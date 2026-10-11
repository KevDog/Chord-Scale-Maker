import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// the same base rules as the app's (withNuxt, which Nuxt generates with features.standalone), without a Nuxt build
export default createConfigForNuxt({ features: { standalone: true } }).append({
  // the engine is pure TypeScript: no Vue, no VexFlow, no DOM, no app code (docs/design.md §3)
  files: ['src/**/*.ts', 'scripts/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['vue', '@vue/*', 'vexflow', '#app', '#imports', '~/*', '~~/*', '@chord-scale-maker/*'],
            message: 'The engine imports nothing from the app, Vue or VexFlow.',
          },
        ],
      },
    ],
  },
})
