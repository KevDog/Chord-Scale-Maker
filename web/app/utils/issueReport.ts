import type { InjectionKey } from 'vue'
import { glyphs, type InstrumentName, INSTRUMENTS } from '~~/engine'
import { instrumentOption } from '~/utils/instrumentChoices'

/** "Report issue" on the Changes sheet's reason note (docs/superpowers/specs/2026-10-10-functions-help-page-design.md §1.4) */

export const ISSUE_REPO = 'https://github.com/KevDog/Chord-Scale-Maker'
/** a URL GitHub's new-issue page reliably accepts */
export const URL_LIMIT = 8000
/** the contact form's pre-fill, set just before going there (sessionStorage) */
export const ISSUE_TEXT_KEY = 'csm-issue-text'
/** the part the sheet is written for: its name with its key ("B♭ Trumpet"), and whether it reads other than concert pitch */
export type IssuePart = Readonly<{ name: string; transposes: boolean }>

/**
 * what the note needs from the editor: the chart's title, the part, the library chart's slug when the chart is that
 * chart as published (null otherwise), and a share link of the chart as it is now
 */
export const ISSUE_CONTEXT: InjectionKey<Readonly<{ title: () => string; part: () => IssuePart; library: () => string | null; shareUrl: () => Promise<string> }>> = Symbol('issue context')

/** "trumpet" -> "B♭ Trumpet"; a concert-pitch part by its name alone ("Trombone") */
export function issuePart(name: InstrumentName): IssuePart {
  const { trans } = INSTRUMENTS[name]
  return trans === 'C' ? { name: instrumentOption(name), transposes: false } : { name: `${glyphs(trans)} ${instrumentOption(name)}`, transposes: true }
}

/**
 * chord, heardIn and scale as the sheet shows them for the part; concert, the chart's own symbol (the chord when
 * missing); reason and rule are the analysis's, in concert pitch. at: the chart row (the same chord can be analysed
 * differently in another bar). library: the slug of a library chart as published, which needs no link; link: the
 * share link otherwise, null for none
 */
export type IssueFields = Readonly<{
  title: string
  library?: string
  at?: Readonly<{ section: string; bar: string }>
  chord: string
  concert?: string
  part?: IssuePart
  numeral: string
  heardIn: string
  scale: string | null
  rule: string
  reason: string
  link: string | null
}>

/** the chart's own symbol: the chart, the function and the rule are all in concert pitch */
export const issueTitle = (f: IssueFields): string => `${f.title}: ${f.concert ?? f.chord} (${f.numeral}), rule ${f.rule}`

/** the report; on a transposing part it names the instrument and says which lines are written for it, which concert */
export function issueText(f: IssueFields): string {
  const part = f.part?.transposes ? f.part.name : null
  const written = part ? ` (written for ${part})` : ''
  const concert = f.concert && f.concert !== f.chord ? ` (concert ${f.concert})` : ''
  return [
    `Chart: ${f.title}${f.library ? ` (library chart ${f.library})` : ''}`,
    ...(part ? [`Instrument: ${part}`] : []),
    ...(f.at ? [`Bar: ${f.at.bar} (section ${f.at.section})`] : []),
    `Chord: ${f.chord}${concert}`,
    `Function: ${f.numeral}`,
    `Key area${written}: ${f.heardIn}`,
    `Scale shown${written}: ${f.scale ?? '(none)'}`,
    `Rule: ${f.rule} (${f.reason})${part ? ', in concert pitch' : ''}`,
    'Expected: (the scale you expected, and why: a melody note, a recording, a book)',
    ...(f.link !== null ? [`Link: ${f.link}`] : []),
  ].join('\n')
}

/** a new GitHub issue with the title and the text; the title only when the text would make the URL too long */
export function issueUrl(title: string, body: string): Readonly<{ url: string; full: boolean }> {
  const base = `${ISSUE_REPO}/issues/new?title=${encodeURIComponent(title)}`
  const full = `${base}&body=${encodeURIComponent(body)}`
  return full.length <= URL_LIMIT ? { url: full, full: true } : { url: base, full: false }
}
