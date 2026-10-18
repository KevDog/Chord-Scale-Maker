import { RULES } from './analysis'

/**
 * Every heuristic the app applies when it chooses something for the user, each with a stable id and the page anchor
 * that explains it (docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md §5). The analysis rules keep
 * their own ids and rows on Functions (`rule-M3` → /functions#rule-M3) and are not repeated here. Adding a heuristic
 * adds a row; web/test/docs/decisions.test.ts checks each anchor exists on its page.
 */

export type DocPage = 'help' | 'how-it-decides' | 'functions'

/** anchor: where the explanation lives today (a Help section until How it decides has one of its own, keyed by id) */
export type DecisionInfo = Readonly<{ id: string; title: string; page: DocPage; anchor: string; summary: string }>

export const DECISIONS = [
  { id: 'scale.level', title: 'Scale levels', page: 'how-it-decides', anchor: 'scale.level', summary: 'What Basic, Standard, Advanced and Random reach for, and why a scale you wrote plays at every level.' },
  { id: 'scale.unknown', title: 'Chords it can’t read', page: 'how-it-decides', anchor: 'scale.unknown', summary: 'A chord it can’t read is shown in amber, has no scale until you pick one, and rests in a line.' },
  { id: 'scale.slash', title: 'Slash chords', page: 'how-it-decides', anchor: 'scale.slash', summary: 'Some slash chords take their scale from another chord on their bass: D♭maj7/C plays as C 7sus4♭9.' },
  { id: 'key.area', title: 'Key areas', page: 'how-it-decides', anchor: 'key.area', summary: 'How the key of the moment is found, and where a key change is written in.' },
  { id: 'guide.tones', title: 'The guide tones', page: 'how-it-decides', anchor: 'guide.tones', summary: 'Each chord’s 3rd and 7th, or its 6th, 4th or root where it has no 7th or 3rd.' },
  { id: 'guide.start', title: 'Where a line starts', page: 'how-it-decides', anchor: 'guide.start', summary: 'A line starts in the octave that keeps it nearest the middle of your range up to the next rest.' },
  { id: 'guide.move', title: 'How a line moves', page: 'how-it-decides', anchor: 'guide.move', summary: 'At each chord the line takes the nearer guide tone: a common tone, then a half step, a whole step, then a leap.' },
  { id: 'guide.range', title: 'A line’s range', page: 'how-it-decides', anchor: 'guide.range', summary: 'A line stays in your instrument’s comfortable range and turns back at the floor or the ceiling.' },
  { id: 'guide.meet', title: 'When the two lines meet', page: 'how-it-decides', anchor: 'guide.meet', summary: 'From 3rd and From 7th part at the next new chord after they land on the same note.' },
  { id: 'guide.rest', title: 'Rests, repeats and spelling', page: 'how-it-decides', anchor: 'guide.rest', summary: 'A chord with no guide tones rests, repeats play as written, and each note keeps its chord’s spelling.' },
  { id: 'range.instrument', title: 'Written ranges', page: 'how-it-decides', anchor: 'range.instrument', summary: 'Each instrument’s comfortable written range, which every line keeps to.' },
  { id: 'arp.line', title: 'The 7th Chords line', page: 'how-it-decides', anchor: 'arp.line', summary: 'How the 7th chord arpeggio line orders its notes, turns back and keeps its rhythm.' },
  { id: 'arp.sheet', title: 'The Arpeggios sheet', page: 'how-it-decides', anchor: 'arp.sheet', summary: 'How each line’s arpeggio runs: a 7th chord over two octaves, or Extended, its tensions stacked above.' },
  { id: 'patterns.run', title: 'The Patterns sheet', page: 'how-it-decides', anchor: 'patterns.run', summary: 'How a pattern’s steps run over each scale line, through the scale or the chord tones.' },
  { id: 'cells.line', title: 'Cells', page: 'how-it-decides', anchor: 'cells.line', summary: 'A four-note cell on each chord, two beats each, read through the chord’s scale.' },
  { id: 'cells.system', title: 'Cell systems', page: 'how-it-decides', anchor: 'cells.system', summary: 'Cells A and B take turns, so each ends a step from where the next begins.' },
  { id: 'approach.figures', title: 'Approach figures', page: 'how-it-decides', anchor: 'approach.figures', summary: 'The figures that lead into a chord’s note, and how their steps are spelled.' },
  { id: 'approach.place', title: 'Where an approach goes', page: 'how-it-decides', anchor: 'approach.place', summary: 'An approach takes the last beat or two of the chord before, and where there’s no room it’s left out.' },
  { id: 'pent.auto', title: 'Pentatonic Auto', page: 'help', anchor: 'practice', summary: 'Auto picks the minor pentatonic that shares the most notes with the scale, nearest the chord’s root.' },
  { id: 'pent.inside', title: 'Inside and outside pentatonics', page: 'help', anchor: 'practice', summary: 'How pentatonics are ranked from inside to outside against each chord.' },
  { id: 'pent.line', title: 'The Pentatonic line', page: 'help', anchor: 'controls', summary: 'Each chord’s pentatonic in four-note cells, with the note left out and the turns at your range’s edges.' },
  { id: 'hex.auto', title: 'Hexatonic Auto', page: 'help', anchor: 'practice', summary: 'Auto picks the triad pair that covers the most chord tones.' },
  { id: 'hex.group', title: 'Hexatonic groupings', page: 'help', anchor: 'practice', summary: 'How the six notes of a triad pair are split in two and tinted apart.' },
  { id: 'hex.line', title: 'The Triad pair line', page: 'help', anchor: 'controls', summary: 'Each chord’s triad pair a triad at a time, its lower triad first.' },
  { id: 'pick.order', title: 'The order of chord picks', page: 'help', anchor: 'practice', summary: 'A chord pick’s list runs from inside to outside.' },
  { id: 'spell.root', title: 'Spelling a scale', page: 'how-it-decides', anchor: 'spell.root', summary: 'Each scale takes the spelling with no double flats or sharps, no B♯, E♯, C♭ or F♭, then the fewest accidentals, then the sharp or flat side it was written on.' },
  { id: 'spell.transpose', title: 'Spelling a new key', page: 'how-it-decides', anchor: 'spell.transpose', summary: 'Transposing spells roots on the new key’s side: D♭–7 G♭7 in B♭, not C♯–7 F♯7.' },
  { id: 'spell.chord', title: 'Spelling a chord symbol', page: 'how-it-decides', anchor: 'spell.chord', summary: 'A chord symbol follows its scale’s spelling, and a slash bass keeps its interval from the root.' },
] as const satisfies readonly DecisionInfo[]

export type DecisionId = (typeof DECISIONS)[number]['id'] | `rule-${string}`

const BY_ID: ReadonlyMap<string, DecisionInfo> = new Map(DECISIONS.map((d) => [d.id, d]))

/** the link, title and one-line summary for a decision or an analysis rule (`rule-M3`) */
export const decisionOf = (id: DecisionId): Readonly<{ href: string; title: string; summary: string }> => {
  const d = BY_ID.get(id)
  if (d) return { href: `/${d.page}#${d.anchor}`, title: d.title, summary: d.summary }
  const rule = id.startsWith('rule-') ? RULES.find((r) => `rule-${r.id}` === id) : undefined
  if (rule) return { href: `/functions#${id}`, title: `Rule ${rule.id}`, summary: rule.summary }
  throw new Error(`unknown decision: ${id}`)
}

export const decisionHref = (id: DecisionId): string => decisionOf(id).href
