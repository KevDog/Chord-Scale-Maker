/**
 * The docs gate (docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md §7.3, §12): a PR that changes what a
 * user sees changes the docs too, or says why not in its body with a line `Docs: none — <reason>`; and adds a release
 * note, or says why not with `Release notes: none — <reason>`. Run by check-docs.ts in .github/workflows/docs.yml.
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

/** the release notes (docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md §12): a user-facing PR adds one */
export const RELEASE_NOTES_FILE = 'web/app/utils/releaseNotes.ts'

const ESCAPE = /^Docs: none (?:—|--) (.*\S.*)$/m
const NOTE_ESCAPE = /^Release notes: none (?:—|--) (.*\S.*)$/m
const SHOWN = 10

export type GateResult = Readonly<{ ok: true; why: string } | { ok: false; triggers: readonly string[]; message: string }>

export const docsGate = (files: readonly string[], body: string | null): GateResult => {
  const hasDocs = files.some((f) => HAS_DOCS.some((r) => r.test(f)))
  // the docs themselves (decisions.ts is engine source) don't call for docs
  const triggers = files.filter((f) => NEEDS_DOCS.some((r) => r.test(f)) && !HAS_DOCS.some((r) => r.test(f)))
  if (!triggers.length) return { ok: true, why: hasDocs ? 'docs changed' : 'no user-facing change' }
  // the PR template's comments are hints, not a reason
  const text = (body ?? '').replaceAll('\r\n', '\n').replace(/<!--[^]*?-->/g, '')
  const reason = ESCAPE.exec(text)?.[1]?.trim()
  const noteReason = NOTE_ESCAPE.exec(text)?.[1]?.trim()
  const docs = hasDocs ? 'docs changed' : reason ? `Docs: none — ${reason}` : null
  const note = files.includes(RELEASE_NOTES_FILE) ? 'release notes changed' : noteReason ? `Release notes: none — ${noteReason}` : null
  if (docs && note) return { ok: true, why: `${docs}; ${note}` }
  const more = triggers.length > SHOWN ? `\n  …and ${triggers.length - SHOWN} more` : ''
  const message = [
    'This PR changes user-facing behaviour:',
    ...triggers.slice(0, SHOWN).map((f) => `  ${f}`),
  ].join('\n') + more + [
    ...(docs ? [] : ['', 'It changes no documentation page. Update the docs (Help, How it decides, Functions or engine/src/decisions.ts), or add a line to the PR description:', '  Docs: none — <why no docs change is needed>']),
    ...(note ? [] : ['', `It adds no release note. Add one to ${RELEASE_NOTES_FILE}, or add a line to the PR description:`, '  Release notes: none — <why a user won’t notice>']),
  ].join('\n')
  return { ok: false, triggers, message }
}
