import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // chart text is user input: never render it as HTML (docs/design.md §9)
    'vue/no-v-html': 'error',
  },
})
