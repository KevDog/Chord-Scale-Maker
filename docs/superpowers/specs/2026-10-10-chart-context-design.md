# Chart context: `context:`, `@context`, and the detection fixes

Date: 2026-10-10. Status: approved (decisions below are the user's). Source: the research in
[docs/research/2026-10-jazz-theory-vs-engine.md](../../research/2026-10-jazz-theory-vs-engine.md) §3.3 and §5 P2/P5,
with the detail in its appendix [B-context.md](../../research/2026-10-jazz-theory-vs-engine/B-context.md).
Independent of the labels and rules specs; lands after them to keep the golden diffs separable.

## Goal

The analyser decides whether a chart is functional, modal or blues by heuristic (plan §5.4), and the decision
silently switches rule families on and off (modal: every chord its own mode, no key areas; blues: I7/IV7 as tonic
and subdominant, no key areas). The heuristic is right on most of the library and brittle at the edges. Let the
author state the context, as they already state a key, a scale or a function (principle 1); make the detection
visible; and fix the three detection defects the research found.

## Decisions

| Question | Decision |
| --- | --- |
| Field | `context: functional \| modal \| blues` in the chart header. Absent = detected, as today. A written value always wins. |
| Name | `context:` — already the engine's word (`Analysis.context`). Not `style:` (feel; stays as it is), not `idiom:`, not `analysis:` (collides with the saved `# analysis:` line). |
| Section marker | `@context SECTION BAR VALUE`, parallel to `@key`. Specified here; built when a chart needs it. |
| Minor flavour | `minor: dorian \| aeolian` is reserved, not built: the sources split, the ladder already offers Aeolian at Basic, no library chart needs it. The parser accepts and ignores it with a report line. |
| Bossa/samba | Not a context. Chediak applies one harmonic system across the whole bossa/MPB songbook; Berklee analyses Wave and Ipanema with ordinary labels; 27 of 27 `style: Latin` charts read functional. |
| Report | Always says which decided: `context: modal (stated)` or `context: modal (detected: 0 of 8 chords in cadences, median chord 2 bars)`. |

## 1. Format

```
title: Footprints
key: Cm
style: Blues
context: modal          # the whole tune
form: A, 12 bars
```

- `MetaKey` gains `context` (and `minor`, accepted and ignored). Unknown values are a header error with the same
  tolerance as a bad key: the editor shows it, the analyser falls back to detection and the report says so.
- `@context SECTION BAR VALUE` is parsed like `@key` (chart-functions spec §1). It holds from that bar until the
  next `@context`; before the first, the header's `context:` or the detection. Orthogonal to `@key`. Inside a
  `modal` span key areas are off and the span's tonic is its first chord (M&H p. 186; N&G p. 154); inside a
  `blues` span the blues rules apply with the span's bar 1 as the I. **Parse and validate it now; the analyser
  may treat it as "not yet supported: using the chart's context" with a report line until a chart needs it.**
- The site ignores both (no UI).

## 2. Engine

### `prepare()` (`index.ts`)

- Precedence for the context: `stated ?? detected`. For the key: `stated ?? blues ?? scoreKey` — today it is
  `blues ?? stated ?? …`, so a detected blues overrides a written `key:`, against principle 1 and §12. No library
  chart changes (25 of 25 agree), so this is a latent fix.
- `Analysis` gains `contextSource: 'stated' | 'detected'` and the detection numbers (cadence share, median bars,
  dominant share, form test) for the report line.

### Detection fixes (`keys.ts`)

- **Modal guard.** A chart in which more than half of the chords are dominant 7ths is not modal, unless they all
  share one root (a Mixolydian tonic, M&H p. 190). Modal music is poor in dominants (M&H p. 187; N&G p. 153);
  today an all-dominant tune has no cadences by the engine's definition and reads modal. Library: Locomotion
  (20 of the 23 "modal: its own mode" dominant rows in the fixture).
- **Blues by section.** When the form is 12-12-8-12 (`AABC, 44 bars`; Levine p. 226) or 12 bars repeated, test the
  first 12-bar section for the blues pattern. Keep the dominant-on-bar-1 and dominant-on-bar-5 tests: do not widen
  them to "tonic and subdominant of any quality", because Solar's and the Bird blues' key areas depend on their
  being read as functional; `context: blues` declares those charts instead. Library: Locomotion, Tee Pee Time.
- **Stated key beats the blues key** (above).
- The thresholds (⅓ of chords in cadences; median ≥ 2 bars; the ½ dominant cut) stay unsourced numbers; the
  report line makes them visible. Footprints sits exactly on the median threshold; `context: modal` pins it.

### What a stated context does

| Value | Rules | Key areas |
| --- | --- | --- |
| `functional` | cadences, functions, areas (today's default branch) | on |
| `modal` | each chord its own mode: M5, m6, D7, s3 (h1 is dropped by the rules spec) | off |
| `blues` | I7/IV7 by D5 (the rules spec puts D5 before D3); the I is `key:` else bar 1 | off |

A minor blues is `context: blues` with minor-key rules inside; it changes the label and the key source, not the
scales (Levine p. 225; M&H pp. 143–144; N&G p. 103).

## 3. Library edits

With the field, then `npm run analyse -- --all --force --save` and `make golden`; the expected diffs are listed.

| Chart | Add | Expected change |
| --- | --- | --- |
| Footprints | `context: modal` (keep `style: Blues`) | none (pins the brittle detection) |
| Locomotion | `context: blues` | `Eb7` IV7 rows → E♭ Mixolydian by D5 (were "modal: its own mode"); I7 rows D5 |
| Tee Pee Time | `context: blues` | reason text only (I7 no longer "extended dominant") |
| Mr. P.C., Birk's Works, Côte d'Azur, Blues Minor | `context: blues` | label/reason only; scales unchanged |
| F Bird Blues, Bb Bird Blues | `context: blues` | **check**: blues turns key areas off; if their tonicising ii–Vs lose a scale, leave them functional and note it |
| Watermelon Man | `context: blues` (16 bars) | I7/IV7 reasons; detection of 16-bar forms is not added |
| All Blues, F Jazz Blues, etc. (the 20 detected) | none | the report now prints `(detected: …)` |

## 4. Tests

- Parser: `context:` round-trips; a bad value is a header error; `@context A 1 modal` parses and serialises;
  `minor:` is accepted and reported as ignored.
- `prepare()`: a stated context beats detection; a stated key beats the blues key (a 12-bar `Bb7 … Eb7` chart with
  `key: Eb` reports E♭).
- Detection: Locomotion without `context:` is not modal (guard); with the 12-12-8-12 test it is blues; `Eb7` bar 5
  → D5. A synthetic one-root dominant vamp (`G7` ×16) stays modal/static.
- Report: the context line with its numbers, for a stated and a detected chart.
- Golden: the library diffs in §3 and nothing else.
- `--ambiguous`: list charts whose detection sits within one chord of a threshold ("Footprints: modal by the median
  exactly; consider `context:`"), so the field gets written where it matters.

## 5. Docs

docs/plan-analysis.md §5.4 (the field, the guard, the section test, the thresholds stated as unsourced); §12.1
(the header and `@context`); docs/design.md chart format; README chart format (`context:` and `@context`); the
functions help page's "writing a function" section does not change.

## 6. Out of scope

`minor:` (reserved). An 8/16-bar blues detector (declare with `context:`). A `nonfunctional` context (N&G pp. 162–166;
no rule set exists). Melody-based anything (§14).
