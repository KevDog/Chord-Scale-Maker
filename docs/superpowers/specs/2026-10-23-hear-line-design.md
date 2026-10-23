# Hear line (#507, part 1)

Rhythm roadmap §5 "Phase 5: hear it" waits on #507 (Playback Phase 2): sound what the sheet already draws. This
first part sounds the Changes sheet's Line with the click. The Scales play button and the Arpeggio cells are later
parts of #507.

## What it does
- The click bar gets a **Hear line** toggle, shown with the Changes sheet and a Line on (guide tones, 7th chords,
  pentatonic, triad pair, quartal, cells). While the click runs, the Line sounds with it: the drawn notes, in the drawn
  rhythm, at concert pitch, in one neutral synthesized lead sound.
- The toggle is remembered in this browser with the click's other settings. It starts off.
- Behind the `hearLine` flag (off; e2e builds turn every flag on).

## How it follows the form
- The click counts bars from its start, count-in first. Bar n after the count-in plays the sheet's drawn bar
  (n mod the drawn bars): the form loops from the top. A held tie into the first bar doesn't carry over the loop.
- Bars play in drawn order, once each: repeat signs, 1st/2nd endings and D.S./Coda aren't followed yet (#559).
  A written-out repeat (`copy:`) is drawn, so it plays.
- The click keeps the main metre (as it says, "meter changes play the main meter"); a note that starts past the
  click's bar (in a longer bar) is left out. A tied note holds over the barline.

## The notes (engine `voice.ts`, pure)
- `voiceNotes(bars, trans)`: the drawn bars' voices as notes `{ bar, at, beats, midi }`: rests dropped, tied notes
  merged into one (its length the sum, across barlines too), midi at concert pitch (written − the part's
  transposition interval). Octave transpositions (tenor, bari, guitar, bass) are ignored, as on the sheet, so the
  line sounds where a C instrument would read it (decision `hear.pitch`).
- `scheduleVoice(notes, bars, plan, state, from, until)`: the notes to book in `[from, until)` on the audio clock,
  from the same clock state and plan the click is scheduled from, so the two never drift. A note before `from` is
  skipped, as a click is.
- Swing: with the click's feel on Swing, an 8th off the beat (at .5 of a beat) moves to two thirds of the beat, and a
  note ending there ends there; other times stay (decision `hear.swing`). Straight and Quarters play as drawn.

## The sound
- One voice made by synthesis in `clickSounds.ts` (no samples, no CSP change): a triangle and a quieter sine an
  octave up through a low-pass, with a short attack and release, held for 90% of the note's length so repeated notes
  are heard. Sampled sounds are #534.

## Not in this part
- Scales: a play button per staff; Arpeggios: each cell's pattern (#507, later parts).
- Repeats, endings and D.S. in the clock (#254's form-following stretch).
- The rhythm track, and the swing slider (rhythm roadmap Phase 5, after #507).

# Part 2: play a staff (#507)

## What it does
- Scales: each staff gets a **Play** button by its label. It sounds the scale up and down (the top note once), in
  8ths at the click's tempo, swung with the click on Swing, the last note a quarter. With Practice on, only the
  selected notes play, in the same order.
- Arpeggios (and Patterns): each staff's Play button sounds its notes in drawn order, in 8ths, the last a quarter. A
  Block triad pair sounds each beamed group as one chord, a quarter each.
- Concert pitch and octaves as Hear line (decision `hear.pitch`); swing as `hear.swing`.
- The button turns to **Stop** while it plays; another staff's Play stops it. It needs no click: with the click
  stopped it starts at once on its own; with the click running it starts on the click's next bar, so it fits the
  time. Stopping the click stops it too. The click bar needn't be open.
- On the song page only (the scale reference pages have no click), behind the `hearLine` flag.

## The notes (engine `voice.ts`, pure)
- `PhraseNote = { at, beats, midi }`: beats from the phrase's start, concert pitch.
- `scalePhrase(notes, selected, trans)`, `arpeggioPhrase(notes, groups, block, trans)`: the phrases above.
- `timePhrase(phrase, tempo, feel, start)`: the phrase as `TimedNote`s from `start`, swung as `scheduleVoice` swings.

## The player (`useClick`)
- `play(id, phrase)`, `playing` (the id sounding, or null), `stopPhrase()`; one phrase at a time. The phrase is
  booked at once; `ClickAudio.note` returns a stop for each note, which Stop calls. When it ends with the click
  stopped, the audio suspends.

## Not in this part
- The Pentatonic overlay's rungs sounding their pentatonic (#507, part 3).
