# Hear the rhythm (Rhythm Phase 5, #521)

Roadmap: `docs/superpowers/proposals/2026-10-22-rhythm-roadmap.md` §5, "Phase 5: hear it".

## Intent

A player who has put a rhythm on the Changes sheet should hear it while they practise: the rhythm tapped with the
click, and the Line (when one is shown) sung in that same rhythm, so ear and eye agree. A swing they can dial lets
them practise a ballad's lazy triplet and a medium-up's tighter 8ths with one tool.

## What exists (gap)

- **Click patterns** (Bergonzi 31) shipped in #558: `ClickPattern`, `defaultPattern(feel)`, the **Click on** listbox.
  Nothing more to do for that ask.
- **Hear line** (#560–#562): `voiceNotes(bars, trans)` reads each drawn bar's `voice`; `scheduleVoice` books it with
  the click. Under a rhythm the drawn voice is already the poured one (`GuideNote.mark`, rests as `pitch: null`), so
  the Line should already sound in the rhythm. **Unproven**: PR 1 adds the test.
- **Swing** is fixed: `swingBeat` moves an off-beat 8th to ⅔ (`voice.ts`); `clickBar`'s swing `sub` is ⅔
  (`click.ts`). No dial.
- **Rhythm line notes** exist only with the Line off: `ChangesBar.rhythm` is `[]` when a Line takes the rhythm
  (`changes.ts`, `notes = laid && line === 'off' ? …`).

## Goals

1. **Rhythm track.** With a rhythm on the Changes sheet, Start plays its attacks on an unpitched sound alongside the
   click.
2. **Line in its rhythm.** With a Line shown under a rhythm (`takesRhythm`), the Line's notes sound at the rhythm's
   attacks: the rhythm track and the Line together.
3. **Swing dial.** How far an off-beat 8th sits, 50% (straight) to 75% (dotted 8th + 16th), moving the click's skip
   note, the rhythm track and the Line together.

## Non-goals

- Click patterns (done, #558).
- Turning `hearLine` on in production (a separate ask of the user after this).
- Rhythm sounds on the Scales or Arpeggios sheets' phrase buttons (`<PhraseButton>`): Changes only.
- A drum kit or a groove per style; one unpitched voice.
- Swing for 16ths or tuplets.

## Anti-goals

- The rhythm track drifting from the drawn rhythm: it is read from what the sheet draws, never re-derived.
- A second control row: controls stay inline in the click's popover (a button on its own line broke the
  focus-mode page-fit e2e, `editor.spec.ts`).

## Design

### 1. The rhythm track (engine)

- New pure function in `engine/src/voice.ts` (or a sibling `rhythmTrack.ts`, builder's call):
  `rhythmHits(bars) → RhythmHit[]`, `RhythmHit = { bar, at, accent }`. Source per bar:
  - Line off: `bar.rhythm`; a hit for every note that is not a rest and not `tiedIn`.
  - Line takes the rhythm: `bar.voice`; a hit for every note with a pitch that is not `tiedIn` (`GuideNote.tiedIn`,
    set from the rhythm's tie when pouring; the held note never re-strikes). Accent from `mark.accent`.
  - Neither (no rhythm, or a guide line without Restate): no hits.
  The caller passes the bars it already draws (`ChangesBar[]`); one function, both sources, so the two can't
  disagree.
- `scheduleRhythm(hits, bars, plan, state, from, until) → TimedHit[]`: the same loop as `scheduleVoice` (count-in
  skipped, form loops, nothing booked late, nothing past the click's bar). Share the loop with `scheduleVoice`
  rather than copy it (builder's call how).
- Swing applies as for the voice (§3).

### 2. The app

- `useClick`: a `setRhythm({ hits, bars })` beside `setLine`; the scheduler books hits when `settings.hearRhythm` is
  on, through a new `audio.hit(time, accent)`.
- `ChangesSheet.vue` calls `setRhythm` where it calls `setLine` today (line ~142), from the same drawn bars.
- Sound (`clickSounds.ts`): a **rim** hit, a short filtered-noise burst, distinct from both click sounds
  (`wood`, `beep`); an accent is louder (roughly the click's accent/beat ratio). My call.
- Setting: **Hear rhythm** switch in the click's popover, beside Hear line; stored in `ClickSettings`
  (`hearRhythm`, default **on**: it only sounds when a rhythm is drawn). My call. Shown only when the drawn bars
  yield hits (`useClick` exposes `hasRhythm` from the hits passed to `setRhythm`; a guide line without Restate,
  which draws no rhythm, hides it) and `hearLine` (the flag) is on. The stored Hear line setting is `hear`.
- Flags: behind `hearLine`; also needs `rhythm` (no rhythm otherwise).

### 3. Swing dial

- Engine: `swingBeat(at, ratio = 2/3)`; `scheduleVoice`/`scheduleRhythm`/`timePhrase` take the plan's ratio.
  `ClickOptions` gains `swing?: number` (default 2/3); `clickBar`'s swing `sub` uses it. Only an exact off-beat 8th
  (`at % 1 === 0.5`) moves; lengths follow (`swing(at + beats) − swing(at)`), as today.
- `clampSwing`: 0.5–0.75, steps of 0.01. My call on the range and step.
- **Only 8th beats swing** (my call): a beat swings only when every attack and note end inside it falls on its
  downbeat or its "and" (`at % 1` of 0 or 0.5). A beat holding a 16th, a dotted 8th's end at .75, or a tuplet
  stays straight, so 75% can never land an "and" on a 16th (no collisions, no zero-length notes). The swing
  function therefore takes the bar's notes (or a per-beat "swings" set built from them) as well as the ratio; the
  click's skip note always swings (it is alone in its beat).
- App: a **Swing** slider (range input) in the click's popover, shown when Feel is Swing; label shows the percent
  ("67%"). Stored per chart only once the player moves it, with its own chosen flag like `patternChosen`; until
  then ⅔ (my call). Phrase buttons
  (`play(id, phrase)`) use the same ratio.
- Straight feel stays 50%; Quarters has no 8ths.

## Docs

- `decisions.ts`: new `hear.rhythm` (what the rhythm track plays: attacks, ties held, accents louder, read from the
  drawn rhythm); update `hear.swing` (the dial, default ⅔). Summaries use ’ not `'`.
- How it decides and Help (the click paragraph): the rhythm track, Hear rhythm, the Swing dial.
- Release notes: none while `hearLine` is off; the PR body says so.

## Delivery

Two PRs, TDD engine first:

1. **Rhythm track**: the Line-in-rhythm test (proves goal 2 or fixes it), `rhythmHits`, `scheduleRhythm`, rim
   sound, Hear rhythm switch, docs `hear.rhythm`.
2. **Swing dial**: ratio through engine and app, slider, docs `hear.swing`.

## Tests

- Engine: `voice.test.ts`: a Line poured into a rhythm sounds at its attacks (rests silent, ties one long note);
  `rhythmHits` from `bar.rhythm` and from a poured voice, accents, ties, none for a guide line without Restate;
  `scheduleRhythm` loops/count-in like the voice; swing ratio at 0.5, ⅔, 0.75; `clickBar` with `swing`.
- App: `useClick` books hits only with Hear rhythm on; stored settings round-trip `hearRhythm` and swing;
  `clickSounds` rim hit; ClickBar shows Swing only under Swing feel and Hear rhythm only with a rhythm.
- e2e: Hear rhythm and Swing set in the popover, remembered after reload.

## Left to the builder

File placement for the rhythm-track functions, how `scheduleVoice` and `scheduleRhythm` share their loop, the rim
sound's exact synthesis, the slider's markup within the Catalyst kit.
