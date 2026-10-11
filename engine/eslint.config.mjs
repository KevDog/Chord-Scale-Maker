import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// the same base rules as the app's (withNuxt, which Nuxt generates with features.standalone), without a Nuxt build
export default createConfigForNuxt({ features: { standalone: true } })
