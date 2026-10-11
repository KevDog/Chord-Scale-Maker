# Independent guide tone lines, one at a time: design

Date: 2026-10-10. Status: implemented. Supersedes rule 7 and the
"both on" display of [2026-10-10-guide-tone-lines-design.md](2026-10-10-guide-tone-lines-design.md); keeps the ranges
of [2026-10-10-guide-tone-ranges-design.md](2026-10-10-guide-tone-ranges-design.md).

## Goal

Each guide tone line is built on its own, as a player builds it by hand: start on the first chord's 3rd (or 7th) and
move to the nearer guide tone of each chord that follows. The two lines no longer contend for a note, and the Changes
sheet shows one line at a time.

## Decisions (the user's)

| Question | Decision |
| --- | --- |
| Construction | Line A (from the 3rd) and line B (from the 7th) are each built independently by rules 1–6 and 8–10 of the guide tone lines spec. Rule 7 (the lines take different tones; the collision rule and its trade; crossing) is removed. |
| Display | At most one line on the staff. There is no "both" option. |
| Control | A three-way segmented control under the Guide Tones heading on the Changes toolbar: **Off · From 3rd · From 7th** (the existing `SegmentedControl` component). Default Off. |
| Backward compatibility | None. No links have been shared and no setting needs migrating: the old preference keys and the old share-link fields go, including the legacy `guideThird`/`guideSeventh` decoding. |

## 1. Engine

- `GuideShow` (`{ fromThird, fromSeventh }`) is replaced by `type GuideLine = 'off' | 'third' | 'seventh'`
  (`engine/guideTones.ts`), with `NO_GUIDES`/`guidesOn` replaced by `'off'` and `line !== 'off'`.
- `engine/guideToneLines.ts`: `guideToneLine(tones, range, from: 'third' | 'seventh', blocks?)` builds one line by rules
  1–6 and 8–10: its start (rule 1, the chosen degree in the octave nearest the centre), the nearer guide tone at each
  chord (rule 2), ties (rule 3), the range (rule 4), holds (rule 5), rests and restarts (rule 6), form (rule 9),
  spelling (rule 10). The pair function `guideToneLines` and everything rule 7 needed (`together`, the trade, the
  collision tie-break) are removed.
- `guideVoices(chords, part, beats, keySig, line)` voices the one line, or nothing for `'off'`; one voice per bar.
- `buildChanges(…, guides: GuideLine)`; `ChangesBar.voices` and `ChangesChord.guide` hold a single voice and a single
  label.
- The share view carries `guideLine: GuideLine` (absent = off); `fromThird`/`fromSeventh` and the legacy names go.
- The comparison script (`npm run guide-lines`): measures each line built alone; `--compare` keeps the pair search
  (`voiceLead`) for reference only.

## 2. Drawing (`app/utils/changesDrawing.ts`, `guideToneDrawing` helpers)

One voice: stems by the usual rule (up below the middle line, down above), one set of ties, one label row. Removed:
sorting the two voices by pitch, forcing stems apart, ties curving away from the other voice, the accidental logic
across two voices, the two-label rows. The measure rule for accidentals keeps applying to the one voice. Print layout
(`changesLinesPerPage`) is re-checked; one voice is never taller than two.

## 3. App

- `PreviewControls.vue`: the From 3rd / From 7th toggle buttons become `<SegmentedControl legend="Guide tones"
  name="guide-line" :options="[Off, From 3rd, From 7th]" v-model="guideLine">`.
- `usePreferences`: one stored ref, `csm-guide-line` (`off | third | seventh`, default `off`); `fromThird`/`fromSeventh`
  go. `linkPreferences` takes the share view's `guideLine`.
- `ChangesSheet`/`EditorView` pass `guideLine`. The chart-error report's `guides:` value is `from 3rd`, `from 7th` or
  empty.
- Help ("The preview controls" and "The two sheets") and the functions page's mentions describe one line at a time.

## 4. Testing

- Engine (TDD): independence — the guide tone lines spec's collision example `Cmaj7 | Ebmaj7` now gives both lines D
  (line A: E4 → D4; line B: B4 → D5, the nearer D from B4); a line's notes are the same whether or not the other line
  would have wanted the same tone; rules 1–6 and 8–10 keep their tests, rewritten for one line; the rule 7 tests are
  deleted; the worked examples' rows read as independent lines (any row that changes is listed in the PR, with why).
- Library test: every line, for every instrument, sounds at every voiced chord, inside its range.
- `guideVoices`/drawing: one voice per bar, stems by the usual rule, ties and the label row.
- App: the segmented control's three states, the preference, the share view field, the report value.
- e2e: the control switches Off → From 3rd → From 7th (one voice drawn, its labels), the choice is remembered and
  shared; the existing guide tone e2e tests are rewritten for one line; print fits as before.
- Measurement (in the PR): `npm run guide-lines` before (the current pair with the trade) and after (each line alone):
  common tone / step / leap shares per line, moves over a tritone, the largest move — for concert treble and a few
  instruments. If a line alone leaps more than the paired line did, say so: the trade existed only because of
  collisions, so the expectation is fewer leaps, not more.

## 5. Docs

The guide tone lines spec: rule 7 and the "both on" display marked superseded by this spec. docs/design.md (the
lines, the drawing, the control). The guide-tone-ranges spec is unaffected.

## Out of scope

Showing both lines at once (dropped). Changing any of rules 1–6, 8–10. The ranges and centres.
