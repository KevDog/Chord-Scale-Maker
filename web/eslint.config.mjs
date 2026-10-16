import vueA11y from 'eslint-plugin-vuejs-accessibility'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // chart text is user input: never render it as HTML (docs/design.md §9)
      'vue/no-v-html': 'error',
    },
  },
  // accessibility of the templates (labels, alt text, ARIA, interactive elements); the axe e2e specs check the pages
  ...vueA11y.configs['flat/recommended'],
  {
    rules: {
      // a label names its control by wrapping it or by `for`; either is enough (the default asks for both)
      'vuejs-accessibility/label-has-for': ['error', { required: { some: ['nesting', 'id'] } }],
      // dialogs focus their first field (a component's autofocus prop), as a dialog should
      'vuejs-accessibility/no-autofocus': ['error', { ignoreNonDOM: true }],
    },
  },
)
