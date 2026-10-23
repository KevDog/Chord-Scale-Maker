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
  { id: 'scale.blues', title: 'A blues', page: 'how-it-decides', anchor: 'scale.blues', summary: 'In a blues the I, IV and V (and a minor blues’ i and iv) play Mixolydian or Dorian at Standard and the key’s Blues scale at Basic.' },
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
  { id: 'arp.line', title: 'The 7th Chords line', page: 'how-it-decides', anchor: 'arp.line', summary: 'How the 7th chord arpeggio line orders its notes, turns back and keeps its rhythm unless a Rhythm is chosen.' },
  { id: 'arp.sheet', title: 'The Arpeggios sheet', page: 'how-it-decides', anchor: 'arp.sheet', summary: 'How each line’s arpeggio runs: a 7th chord over two octaves, or Extended, its tensions stacked above.' },
  { id: 'patterns.run', title: 'The Patterns sheet', page: 'how-it-decides', anchor: 'patterns.run', summary: 'How a pattern’s steps run over each scale line, through the scale or the chord tones.' },
  { id: 'cells.line', title: 'Cells', page: 'how-it-decides', anchor: 'cells.line', summary: 'A four-note cell on each chord, two beats each, read through the chord’s scale.' },
  { id: 'cells.system', title: 'Cell systems', page: 'how-it-decides', anchor: 'cells.system', summary: 'Cells A and B take turns, so each ends a step from where the next begins.' },
  { id: 'approach.figures', title: 'Approach figures', page: 'how-it-decides', anchor: 'approach.figures', summary: 'The figures that lead into a chord’s note, and how their steps are spelled.' },
  { id: 'approach.place', title: 'Where an approach goes', page: 'how-it-decides', anchor: 'approach.place', summary: 'An approach takes the last beat or two of the chord before, and where there’s no room it’s left out.' },
  { id: 'pent.auto', title: 'Pentatonic Auto', page: 'how-it-decides', anchor: 'pent.auto', summary: 'Auto picks the minor pentatonic that shares the most notes with the scale, nearest the chord’s root.' },
  { id: 'pent.inside', title: 'Inside and outside pentatonics', page: 'how-it-decides', anchor: 'pent.inside', summary: 'How pentatonics are ranked from inside to outside against each chord.' },
  { id: 'pent.line', title: 'The Pentatonic line', page: 'how-it-decides', anchor: 'pent.line', summary: 'Each chord’s pentatonic in four-note cells, with the note left out and the turns at your range’s edges.' },
  { id: 'hex.auto', title: 'Hexatonic Auto', page: 'how-it-decides', anchor: 'hex.auto', summary: 'Auto picks the triad pair that covers the most chord tones; on a diminished, whole-tone or augmented scale, the pairs a tritone, a whole step or a minor third apart join the list.' },
  { id: 'hex.sub', title: 'Triad pairs from the tritone sub', page: 'how-it-decides', anchor: 'hex.sub', summary: 'A dominant chord’s list ends with pairs from its tritone sub’s scale (B/D♭ over G7, from D♭7), those covering the most of its chord tones.' },
  { id: 'hex.key', title: 'Hexatonic pairs by key area', page: 'how-it-decides', anchor: 'hex.key', summary: 'Pairs by key area: the IV and V triads of the key, one pair for every chord in it.' },
  { id: 'hex.group', title: 'Hexatonic groupings', page: 'how-it-decides', anchor: 'hex.group', summary: 'How the six notes of a triad pair are split in two and tinted apart.' },
  { id: 'hex.sheet', title: 'Triad pairs on the Arpeggios sheet', page: 'how-it-decides', anchor: 'hex.sheet', summary: 'Each line’s triad pair as six triads, lower and upper in turn through their inversions, arpeggiated or as block chords.' },
  { id: 'quartal.auto', title: 'Quartal Auto', page: 'how-it-decides', anchor: 'quartal.auto', summary: 'Auto picks the stack of fourths with no avoid note that holds the most guide tones, perfect fourths first.' },
  { id: 'quartal.line', title: 'The Quartal line', page: 'how-it-decides', anchor: 'quartal.line', summary: 'Each chord’s stack of fourths played whole, then its next stacks, each placed nearest the last note.' },
  { id: 'hex.line', title: 'The Triad pair line', page: 'how-it-decides', anchor: 'hex.line', summary: 'Each chord’s triad pair a triad at a time, its lower triad first: from the note nearest the last, or climbing through the inversions.' },
  { id: 'pick.order', title: 'The order of chord picks', page: 'how-it-decides', anchor: 'pick.order', summary: 'A chord pick’s list runs from inside to outside.' },
  { id: 'spell.root', title: 'Spelling a scale', page: 'how-it-decides', anchor: 'spell.root', summary: 'Each scale takes the spelling with no double flats or sharps, as few B♯, E♯, C♭ and F♭ as it can, then the fewest accidentals, then the sharp or flat side it was written on.' },
  { id: 'spell.transpose', title: 'Spelling a new key', page: 'how-it-decides', anchor: 'spell.transpose', summary: 'Transposing spells roots on the new key’s side: D♭–7 G♭7 in B♭, not C♯–7 F♯7.' },
  { id: 'backup.charts', title: 'A restored chart that differs from yours', page: 'help', anchor: 'backup-conflicts', summary: 'A chart in a backup that differs from yours comes in beside it as “(imported)” unless you choose otherwise; an edited library tune comes in as a copy.' },
  { id: 'backup.library', title: 'A restored tune’s picks and level', page: 'help', anchor: 'backup-library', summary: 'A library tune’s picks and level in a backup keep yours unless you choose Use imported.' },
  { id: 'alt.same', title: 'An alternate the same as the changes', page: 'help', anchor: 'alternates', summary: 'A bar you give the same chords, scales and functions as the alternate set already plays there (the standard changes, or a chord held from before) isn’t kept as an alternate.' },
  { id: 'backup.preferences', title: 'Restored preferences', page: 'help', anchor: 'backup-preferences', summary: 'A backup’s preferences apply by default only in a browser that has never opened the site.' },
  { id: 'rhythm.cycle', title: 'Where a rhythm is back on one', page: 'help', anchor: 'rhythm-cycle', summary: 'A repeating rhythm ignores barlines, so it lands on a bar’s first beat again after the least common multiple of its length and the bar’s, in bars (8ths in 5 over 4/4: every 5 bars); the caption names the bars.' },
  { id: 'rhythm.tuplet-fallback', title: 'A tuplet pulse in a bar it doesn’t fit', page: 'help', anchor: 'rhythm-tuplets', summary: 'A tuplet never crosses a barline: a bar that isn’t a whole number of the pulse’s tuplets (2 beats for quarter-note triplets and 8th-note quintuplets, 4 for quarter-note quintuplets) plays in plain quarters, or 8ths for 8th-note quintuplets, and the rhythm keeps counting its cells through it.' },
  { id: 'rhythm.path-step', title: 'Where a rhythm path steps', page: 'help', anchor: 'rhythm-groups', summary: 'Each step of a rhythm path starts fresh on its first bar’s beat 1, a note held into it cut with no tie and no pick-up reaching back over it; a list shorter than the form starts over; an intro or an ending plays the first step.' },
  { id: 'rhythm.pour',title: 'A rhythm on a Line', page: 'help', anchor: 'rhythm-pour', summary: 'A Line plays in the rhythm: one note an attack, rests skipped, a tie holds; a chord with more notes than attacks is cut, with fewer its line starts the next cell or turns back.' },
  { id: 'rhythm.pickups', title: 'Start: targets and pick-ups', page: 'help', anchor: 'rhythm-pickups', summary: 'The target and the pick-up are struck even where the rhythm rests; the pick-up plays the chord before’s notes, or after a rest the scale notes below (out of range rests); the first bar has none.' },
  { id: 'rhythm.anticipate', title: 'Timing: anticipate and resolve late', page: 'help', anchor: 'rhythm-anticipate', summary: 'Each chord’s notes begin early or late by a step of half a beat; the chord symbols stay put.' },
  { id: 'rhythm.target-tones', title: 'Target tones', page: 'help', anchor: 'rhythm-target-tones', summary: 'With Target beats on, a chord tone on a dot is lit and any other note on a dot is gray; nothing moves a note onto a dot.' },
  { id: 'rhythm.targets', title: 'Target beats', page: 'help', anchor: 'rhythm-targets', summary: 'The strong beats of a bar, by time signature: beat 1 in 2/4 and 3/4, 1 and 3 in 4/4, 1 and 4 in 5/4 and 6/4, 1 and 5 in 7/4.' },
  { id: 'rhythm.staff-metre', title: 'A staff’s metre', page: 'help', anchor: 'rhythm-card', summary: 'A Scales staff’s rhythm card is in the metre of the bar that holds its first chord, from the chart’s time signature (4/4 where it has none), written as beats over 4; so is its Notes per bar run.' },
  { id: 'rhythm.notes-per-bar', title: 'Notes per bar', page: 'help', anchor: 'notes-per-bar', summary: 'The run is the scale up an octave and back down; a bar of N notes is one note the bar long for 1, one value for all where it fits the bar (or two dotted ones), else a tuplet of the longest value that fits; with a Rhythm, a bar plays its first N attacks and rests the rest.' },
  { id: 'spell.chord', title: 'Spelling a chord symbol', page: 'how-it-decides', anchor: 'spell.chord', summary: 'A chord symbol follows its scale’s spelling, and a slash bass keeps its interval from the root.' },
  { id: 'click.tempo', title: 'The click’s tempo and feel', page: 'how-it-decides', anchor: 'click.tempo', summary: 'The click starts at a tempo and a feel read from the chart’s style: a ballad at 66, medium at 132, up at 220; Latin, bossa and even 8ths straight, the rest swing.' },
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
