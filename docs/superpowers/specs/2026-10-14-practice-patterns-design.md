# Practice patterns

Status: superseded by [2026-10-17-practice-patterns-design.md](2026-10-17-practice-patterns-design.md) (#298).

## The idea

A pattern is a cycle of **moves** between neighbouring notes of a collection, counted in that collection's steps.
`+1 +1 +1 −2` means: step up, step up, step up, then back two. Played from 1 it is 1 2 3 4, then 2 3 4 5, then
3 4 5 6, and so on. The number of moves is the group's length; the moves' **sum** is how far each group starts above
the last (here +1, so a group starts on every degree).

The collection is what the steps count in, so one pattern serves several sheets:

| Collection | `+1 +1 +1 −2` over C Ionian | over Dm7's chord tones |
|---|---|---|
| Scale | C D E F · D E F G · E F G A … | |
| Chord tones | | D F A C · F A C D' · A C D' F' … |

Pentatonics and hexatonics need nothing extra: the collection is just shorter.

## Rules

- A pattern has 2 to 8 moves, each a whole number of steps, 1 to 7, up or down (never 0).
- The moves add up to 1 to 4.
- A group never goes below its first note (so "Up" starts on the lowest note of every group).
- Written `+1 +1 +1 −2`; parsed from a hyphen, minus or en dash, with spaces or commas. A custom pattern is the same
  text, so a share link or a stored preference can carry it as it is.

## Direction

- **Up:** a group on every step of one octave, then the octave itself. Groups reach past the octave (7 1 2 3).
- **Down:** Up reflected: from the octave to the first note, every move negated.
- **Up & down:** both, the octave shared, so no beamed group is cut short.

## Placement

The run is placed whole, by the arpeggios' rule: the octave with the fewest notes out of the part's range, then the
average nearest the range's centre (a tie: the higher). Spelling comes from the written scale or chord tones, so
transposing instruments and enharmonics follow the rest of the app.

## Library (13)

Stepwise: 1 2 3 · 1 2 3 4 · 1 2 3 4 5 · 1 2 3 5 · 1 2 4 3 · 1 2 3 1 · 1 3 2 1 · 1 3 2 4.
Skips and chords: thirds (`+2 −1`) · fourths (`+3 −2`) · triads (1 3 5, 2 4 6 …) · triads with a turn (1 3 5 3) ·
sevenths (1 3 5 7, 2 4 6 8 …).

## Still to decide

- Where it lives: a Patterns sheet beside Arpeggios (one staff a scale line, as `buildArpeggioSheet`), a Line choice
  on the Changes sheet, or both.
- Controls: pattern listbox plus a free-text box, Scale / Chord tones, direction.
- Beam groups come from `groups`; note values, interval labels and accidentals reuse the Arpeggios sheet.
- Flag: `patterns`, off until signed off.
