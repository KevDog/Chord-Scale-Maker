import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// the same base rules as the engine's
export default createConfigForNuxt({ features: { standalone: true } })
