/**
 * The package's public surface: the runtime names its index exports (types are checked by the app's typecheck).
 * A change here is a change to what the app, and any later consumer, can use: update it on purpose
 * (`npx vitest run -u src/__tests__/api.test.ts`) and review the snapshot's diff.
 */
import { expect, it } from 'vitest'
import * as engine from '..'

it('exports the same names', () => {
  expect(Object.keys(engine).sort()).toMatchSnapshot()
})
