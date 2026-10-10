import type { InjectionKey } from 'vue'

/** "Copy for an issue" on the Changes sheet's reason note (docs/superpowers/specs/2026-10-10-functions-help-page-design.md §1.4) */

export const ISSUE_REPO = 'https://github.com/KevDog/Chord-Scale-Maker'
/** a URL GitHub's new-issue page reliably accepts */
export const URL_LIMIT = 8000
/** the contact form's pre-fill, set just before going there (sessionStorage) */
export const ISSUE_TEXT_KEY = 'csm-issue-text'
/** what the note needs from the editor: the chart's title, and a share link of the chart as it is now */
export const ISSUE_CONTEXT: InjectionKey<Readonly<{ title: () => string; shareUrl: () => Promise<string> }>> = Symbol('issue context')

export type IssueFields = Readonly<{ title: string; chord: string; numeral: string; heardIn: string; scale: string | null; rule: string; reason: string; link: string }>

export const issueTitle = (f: IssueFields): string => `${f.title}: ${f.chord} (${f.numeral}), rule ${f.rule}`

export function issueText(f: IssueFields): string {
  return [
    `Chart: ${f.title}`,
    `Chord: ${f.chord}`,
    `Function: ${f.numeral}`,
    `Key area: ${f.heardIn}`,
    `Scale shown: ${f.scale ?? '(none)'}`,
    `Rule: ${f.rule} (${f.reason})`,
    'Expected: (the scale you expected, and why: a melody note, a recording, a book)',
    `Link: ${f.link}`,
  ].join('\n')
}

/** a new GitHub issue with the title and the text; the title only when the text would make the URL too long */
export function issueUrl(title: string, body: string): Readonly<{ url: string; full: boolean }> {
  const base = `${ISSUE_REPO}/issues/new?title=${encodeURIComponent(title)}`
  const full = `${base}&body=${encodeURIComponent(body)}`
  return full.length <= URL_LIMIT ? { url: full, full: true } : { url: base, full: false }
}
