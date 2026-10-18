/**
 * The docs gate (docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md §7.3): a PR that changes what a user
 * sees changes the docs too, or says why not in its body with a line `Docs: none — <reason>`. Run by check-docs.ts in
 * .github/workflows/docs.yml.
 */

/** user-facing behaviour: the engine (not its tests), its scale table, the interface's components and the song page */
export const NEEDS_DOCS: readonly RegExp[] = [
  /^engine\/src\/(?!__tests__\/)/,
  /^engine\/chord_scales\.json$/,
  /^web\/app\/components\//,
  /^web\/app\/composables\//,
  /^web\/app\/pages\/song\//,
]

/** the documentation: its pages and the decision registry */
export const HAS_DOCS: readonly RegExp[] = [/^web\/app\/pages\/(help|how-it-decides|functions|chart-format|glossary)\.vue$/, /^engine\/src\/decisions\.ts$/]

const ESCAPE = /^Docs: none (?:—|--) (.*\S.*)$/m
const SHOWN = 10

export type GateResult = Readonly<{ ok: true; why: string } | { ok: false; triggers: readonly string[]; message: string }>

export const docsGate = (files: readonly string[], body: string | null): GateResult => {
  if (files.some((f) => HAS_DOCS.some((r) => r.test(f)))) return { ok: true, why: 'docs changed' }
  const triggers = files.filter((f) => NEEDS_DOCS.some((r) => r.test(f)))
  if (!triggers.length) return { ok: true, why: 'no user-facing change' }
  // the PR template's comments are hints, not a reason
  const text = (body ?? '').replaceAll('\r\n', '\n').replace(/<!--[^]*?-->/g, '')
  const reason = ESCAPE.exec(text)?.[1]?.trim()
  if (reason) return { ok: true, why: `Docs: none — ${reason}` }
  const more = triggers.length > SHOWN ? `\n  …and ${triggers.length - SHOWN} more` : ''
  const message = [
    'This PR changes user-facing behaviour but no documentation page:',
    ...triggers.slice(0, SHOWN).map((f) => `  ${f}`),
  ].join('\n') + more + '\nUpdate the docs (Help, Functions or engine/src/decisions.ts), or add a line to the PR description:\n  Docs: none — <why no docs change is needed>'
  return { ok: false, triggers, message }
}
