# Approaches into the running lines (#381)

Status: design. Extends Part 3 of [2026-10-17-practice-patterns-design.md](2026-10-17-practice-patterns-design.md)
(#298), which aimed approach figures at the guide tone line's notes only.

## Why

Vincent aims approaches at the next chord's root, 3rd or 5th (pp.23–28). Today the **Approach** listbox only leads into
the guide tone line, a held note per chord. A player working on Cells or 7th Chords wants the same figures leading the
running line into each new chord, so the eighth-note line arrives on the chord through a chromatic or enclosing figure
rather than by step or leap.

## Goals

- The Approach listbox works under the **Cells** line and the **7th Chords** line, not only Guide Tones.
- Each chord's **target** is the running line's own first note over that chord. Which chord tone that is follows from the
  line already chosen: Root to root or 1-2-3-5 lands on roots, 3rd to 3rd on 3rds, 5-3-2-1 on 5ths, the 7th Chords
  pattern on its first note. No separate target picker.
- The figure takes the place of the previous chord's last notes, so the line keeps its rhythm and the target still
  sounds on the chord's first beat.

## Non-goals

- A target picker (root / 3rd / 5th independent of the line). Choosing the line chooses the target.
- Approaches under the Superimpose lines (Pentatonic, Hexatonic): the Approach listbox stays hidden there.
- New figures, triplets, or approaches on the Patterns or Arpeggios sheets.

## Anti-goals (a failure even if it works)

- A target that moves: the running line's own notes over each chord, and its placement from chord to chord, are what
  they are without an approach; only the previous chord's tail changes.
- A wrong spelling (the #298 rules: into E from below is D♯, never E♭).
- A rhythm the line doesn't otherwise play (an eighth among quarters in a 7th Chords bar).
- A third toolbar row at 1440 px, or the Line group widening.
- A note out of the part's range.

## Constraints

- Engine pure TypeScript in `engine/src/`; export only what the app uses (`api.test.ts` snapshot).
- Reuse `approachNotes` (`engine/src/approaches.ts`) for the figure's pitches and spellings; no new figure code.
- Flag `approaches` (on in `web/nuxt.config.ts` already). No new flag: this widens an existing control.
- Tests alongside: engine unit tests first (TDD), a web unit test, the existing layout e2e extended, a11y unchanged.

## What it plays

`cellVoices` (`engine/src/arpeggios.ts`) builds both the Cells line and the 7th Chords line. With an approach other
than None, after the line is built and before accidentals are set (`voiceAccidentals`):

1. For each chord after the first, its **target** is its first sounding note. Skip it when the chord rests, when the
   chord before rests or does not end where it starts (a gap), or when the chord has no note.
2. The figure is `approachNotes(target, approach, scale)`, `scale` being the previous chord's shown scale
   (`shown ?? scale`, as `guideVoices` does). No figure when it returns null.
3. The figure's notes **replace the previous chord's last k notes** (k = the figure's length), each keeping the
   replaced note's beat and length. The figure therefore plays in the line's own note value: eighths in a Cells line,
   sixteenths over a short chord, quarters in a 7th Chords bar of quarters.
4. The whole figure plays, even where its first note repeats the line's note before it (C E G B → F with Diatonic
   above plays C E G G F). Unlike the guide tone line, a running line has no held note to go on into the figure, and
   dropping that note would leave the slot playing the old note and no approach at all.
5. No approach where the previous chord would keep fewer than one of its own notes (its notes count ≤ k), or where a
   figure note is out of the part's range.

The following chord's notes are untouched, and its placement was computed from the unapproached line, so the line's
register is the same with or without an approach.

## Controls

The Approach listbox (`PreviewControls.vue`) shows under Guide Tones as now, and also under the 7th Chords slot when no
Superimpose is on (`inSlot && overlay === 'off'`), beneath the Arpeggio pattern listbox. One stored preference
(`csm-approach`) and one share-link field (`approach`) for all three lines: switching lines keeps the figure.

Where the app today only passes, shares or reports an approach for `lineMode === 'guide'` (`EditorView.vue`: the
`hiddenSettings` view, the share link, the sheet prop), it does so for `guide`, `arpeggio` and `cells` alike, with no
Superimpose for the last two. `buildChanges` passes `approach` to `cellsVoices` and `arpeggioVoices` as it does to
`guideVoices`.

The Help page's Approach paragraph says it also leads the 7th Chords and Cells lines into each chord's first note,
taking the last notes of the chord before.

## Left to the builder

- Whether the approach pass sits inside `cellVoices` (an optional parameter) or as a pure function over its output with
  a chord index per note; either way pure and tested on its own.
- Test charts and exact expected notes.

## Calls made in writing this (not the user's)

- Target = the line's own first note per chord; no target picker (user asked for a recommendation; this was it).
- The figure plays in the line's note value, replacing notes, not in fixed eighths.
- The previous chord keeps at least one of its own notes.
- Not under Pentatonic/Hexatonic Superimpose lines.
- One Approach preference shared by all three lines.
- A chord that repeats the chord before still gets a figure into its first note (as the guide tone line does).
- The pass is an optional `approach` parameter of `cellVoices`, passed only by `arpeggioVoices` and `cellsVoices`; the
  Superimpose lines (`pentatonicVoices`, `triadPairVoices`) also run through `cellVoices` and never pass it (a test
  pins that).
