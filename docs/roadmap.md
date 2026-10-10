# Roadmap

Ideas agreed in principle but not scheduled, and work in progress. Each gets a plan or a PR of its own when it's
picked up.

## Next

### Architecture-audit leftovers (2026-10-09)

A multi-agent audit after the `v2-changes` tag found 13 items; the behavior-preserving refactors landed as PRs #69–78
(DRY of `keyText`/`isTonicType`/`shiftBy`/`spellEqual`/`defaultScaleOrNull`, dead-code and API-narrowing, shared
drawing constants and practice key, plus the `glyphs()` Bebop fix), and the contact email rule as #79. Still open:

- **Date-formatter DRY** — `EditorView.vue` and `MyChartsList.vue` share a today-vs-date formatter; low value and
  locale-string-sensitive, so deferred (not worth an unreviewed merge).
- **Engine coverage** — `voiceLeading.ts` (Viterbi) and `stream.ts` have no direct unit tests; adding them is pure
  upside but wants careful, fresh attention to avoid pinning current behavior as "correct".

### Guide tone ranges per instrument

Today the guide tone lines (`engine/guideToneLines.ts`) take their range from the clef alone (`RANGES` in
`engine/voiceLeading.ts`, written pitch): treble C4–A5 with a comfortable E4–D5 (centre about A4), bass E2–C4 with
G2–G3. Every treble instrument shares one range, so on vibes (F3–F6) the lines never leave the middle of the
instrument, and the leaps over a tritone that remain (18 in treble over the library, e.g. D7 → Gm, C4 → G4) all
come from the C4 floor that the instrument doesn't have.

- **Engine:** an optional written range per instrument in `INSTRUMENTS` (`lo`, `hi`, `comfortLo`, `comfortHi`),
  falling back to the clef's `RANGES` entry; `guideToneLines` and `guideVoices` take the part's range instead of its
  clef. The rules don't change: rule 1's start octave and rule 3's tie-break use the centre, rule 4 the range.
- **Ranges to settle** (written pitch, the instrument's practical range for a line, not its extremes): vibes,
  piano, guitar, flute, trumpet/flugelhorn, clarinet, the saxophones, horn, trombone, tuba, bass. A source per
  instrument; where unsure, keep the clef's range.
- **Measure first:** `npm run guide-lines` per part (`--part`), before and after: common tone, step and leap shares,
  moves over a tritone, and the comparison with the pair search. A wider range should remove the floor leaps; check
  it doesn't let the lines drift to an uncomfortable register (the centre still anchors starts and ties).
- **Tests:** the rule tests keep the clef ranges (they name pitches); new cases for a wider range (no floor turn at
  C4 on vibes) and a narrower one; the library test runs per instrument. The golden fixture doesn't cover guide
  tones, so no fixture change is expected.
- **Open questions:** should the comfortable zone move with the instrument, or stay a register the exercise is sung
  and played in? And does the Scales sheet's fixed written range (scales sit where they read best) stay separate?

## Done

### The Changes sheet

Feature-complete ([plan-changes.md](plan-changes.md)). 1st/2nd endings, D.C./segno navigation and coda symbols are
done via the `@ending`/`@segno`/`@coda`/`@nav` directives
([spec](superpowers/specs/2026-10-09-changes-navigation-design.md)).

### The cookbook's intros and codas

Intros, codas, tags and endings have a home (sections named `Intro`, `Coda`, `Tag`, `Ending`: outside the form).
The charts that noted a left-out intro, coda, tag or verse have had it transcribed from the lead sheets — played
chord-stab intros, coda turnarounds, tags and the odd verse (Stardust). The ones whose "left out" note is a melody
line with no chords (a horn intro) say so; a left-out *form* section or a sheet's *alternate* chords (Jingle Bells'
head, Cherokee's reharmonisations) are out of scope — they're not intros or codas.
