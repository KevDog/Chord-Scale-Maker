# Guide tone lines that meet go apart: note

Date: 2026-10-11. Status: built on branch `guide-lines-diverge` (from `independent-guide-lines`, PR #102) for the
user to compare; not merged. Amends [the independent-lines spec](2026-10-10-independent-guide-tone-lines-design.md),
which keeps rules 1–6 and 8–10 of [the guide tone lines spec](2026-10-10-guide-tone-lines-design.md) and drops rule 7.

## Why

Built on its own, each line remembers only its last note, so once the two lines land on one pitch they stay identical
until the next rest. On PR #102, concert treble, 63% of voiced chords have both lines on one pitch and 140 of 242
charts are identical at more than half their chords. The user's idea: when they come together, send one up and one
down on the next note.

## The rule as built (`web/engine/guideToneLines.ts`)

Both lines are built together again, but only so they can go apart after meeting; otherwise each moves by rules 1–6
on its own.

| | Ruling | Status |
| --- | --- | --- |
| D1 | When the lines share a pitch at a chord, at the next new chord the line that was above before they met moves to the nearest in-range guide tone strictly above that pitch, the other to the nearest strictly below. Together since a restart (only possible if a chord's two guide tones share a pitch, so never with real symbols): line B (From 7th) goes up. | assumed (confirm) |
| D2 | With no in-range candidate on its side, a line takes its nearest candidate on the other side that is not its partner's (the partner on its own side chooses first). If none exists, they coincide again, and D1 applies at the next chord. | assumed (confirm) |
| D3 | Once apart, each line moves by rules 2–6 independently until they meet again. A held chord (rule 5) holds both lines on the shared pitch; they go apart at the first new chord. The same chord across a block boundary is a new chord, so they go apart there. Rests and restarts are as before (a rest ends the run; the restart is rule 1/6 for each line). | assumed (confirm) |
| D4 | The public API stays `guideToneLine(tones, range, from, blocks?)`, returning one line (both are built internally). Nothing above the engine changed; no e2e or app expectation moved. | assumed (confirm) |

Tests: `web/engine/__tests__/guideToneLines.test.ts`, "lines that meet go apart" (D1 both directions, the restart
case, the floor and ceiling of D2, D2's "coincide again", D3 apart / held / block boundary / rest) and, over the
library for every part, "lines that share a pitch differ at the next new chord" (and only move to one side when the
other has no guide tone in range). No existing expected row moved.

## Measurement

The library (242 charts, 8008 chords) voiced as the Changes sheet voices it (written order, folded repeats drawn once,
blocks for holds; the chord sequence of `npm run guide-lines`). Columns: **main** (0814306: the paired lines, rule 7
with the trade), **#102** (894f679: each line alone), **diverge** (this branch). A move is between consecutive voiced
chords of one line within a run; "distinct" counts chords where either line moves more than a tritone. The last row
counts the chords right after a meeting (not held): how many, how many where the lines did not end on opposite
sides (on #102: they stayed together; on diverge: D2 fired), and how many of those moves exceed a tritone.
(The reviewer's 63.2% / 139 for #102 used the chart's rows without folds or blocks; the sheet's sequence gives 63.1% /
140.)


### treble (concert) (range 60-81, centre 69)

| measure | main | #102 | diverge |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 63.1% (5051/8008) | 6.6% (525/8008) |
| charts more than half identical | 0/242 | 140/242 | 0/242 |
| line A: common / step / leap | 28.7% / 60.5% / 10.8% | 28.4% / 62.1% / 9.5% | 28.0% / 60.6% / 11.4% |
| line B: common / step / leap | 27.1% / 61.0% / 11.9% | 27.7% / 62.2% / 10.1% | 26.3% / 60.9% / 12.7% |
| moves > tritone: A / B / distinct chords | 7 / 12 / 18 | 13 / 11 / 14 | 39 / 75 / 114 |
| largest move (semitones) | 9 (smatter B 13, A G5->Bb4) | 7 (autumn_leaves A1 7, A C4->G4) | 12 (baby_steps Intro 16, A E4->E5) |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 4736 / 4736 / 10 | 505 / 55 / 92 |

### bass (concert) (range 40-60, centre 49)

| measure | main | #102 | diverge |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 63.0% (5049/8008) | 6.3% (506/8008) |
| charts more than half identical | 0/242 | 138/242 | 0/242 |
| line A: common / step / leap | 28.5% / 60.8% / 10.7% | 28.3% / 62.9% / 8.8% | 27.3% / 61.3% / 11.4% |
| line B: common / step / leap | 28.1% / 59.7% / 12.1% | 28.0% / 62.5% / 9.5% | 26.6% / 61.1% / 12.3% |
| moves > tritone: A / B / distinct chords | 11 / 11 / 22 | 18 / 15 / 20 | 63 / 58 / 121 |
| largest move (semitones) | 7 (beatrice A 7, A F2->C3) | 8 (the_things_we_did_last_summer A2 16, B C4->Fb3) | 12 (a_night_in_tunisia B 24, A G2->G3) |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 4724 / 4724 / 13 | 481 / 82 / 100 |

### vibes (range 55-86, centre 70)

| measure | main | #102 | diverge |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 51.1% (4096/8008) | 4.2% (336/8008) |
| charts more than half identical | 0/242 | 109/242 | 0/242 |
| line A: common / step / leap | 28.4% / 62.1% / 9.5% | 29.3% / 63.0% / 7.7% | 28.0% / 62.3% / 9.7% |
| line B: common / step / leap | 28.2% / 62.7% / 9.1% | 28.9% / 63.1% / 8.1% | 27.6% / 62.5% / 9.9% |
| moves > tritone: A / B / distinct chords | 9 / 9 / 18 | 14 / 13 / 14 | 33 / 49 / 82 |
| largest move (semitones) | 8 (body_and_soul A2 13, A G3->Eb4) | 8 (body_and_soul A2 13, A G3->Eb4) | 12 (a_weaver_of_dreams A1 15, A C4->C5) |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 3825 / 3825 / 13 | 321 / 37 / 68 |

### trumpet (range 55-79, centre 70)

| measure | main | #102 | diverge |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 46.5% (3724/8008) | 4.6% (367/8008) |
| charts more than half identical | 0/242 | 101/242 | 0/242 |
| line A: common / step / leap | 28.2% / 61.9% / 9.9% | 29.0% / 63.2% / 7.9% | 28.0% / 62.2% / 9.8% |
| line B: common / step / leap | 27.9% / 62.3% / 9.8% | 28.6% / 62.8% / 8.6% | 27.5% / 61.6% / 10.9% |
| moves > tritone: A / B / distinct chords | 7 / 5 / 12 | 10 / 8 / 11 | 32 / 30 / 61 |
| largest move (semitones) | 8 (in_walked_bud A3 26, A Bb3->F#4) | 7 (everything_i_love B 9, B G3->D4) | 12 (all_the_things_you_are B 22, A B3->B4) |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 3469 / 3469 / 7 | 348 / 18 / 46 |

### tenor sax (range 58-84, centre 68)

| measure | main | #102 | diverge |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 56.9% (4557/8008) | 6.0% (482/8008) |
| charts more than half identical | 0/242 | 122/242 | 0/242 |
| line A: common / step / leap | 27.5% / 62.3% / 10.3% | 29.0% / 62.3% / 8.6% | 26.5% / 62.2% / 11.3% |
| line B: common / step / leap | 28.6% / 60.1% / 11.3% | 28.9% / 61.8% / 9.3% | 27.8% / 60.4% / 11.8% |
| moves > tritone: A / B / distinct chords | 3 / 11 / 14 | 8 / 10 / 10 | 40 / 52 / 92 |
| largest move (semitones) | 8 (dance_of_the_infidels A 9, B Db4->A4) | 8 (nardis A1 8, B Bb3->F#4) | 12 (a_weaver_of_dreams A2 22, A D4->D5) |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 4270 / 4270 / 8 | 450 / 61 / 80 |

### trombone (range 40-64, centre 56)

| measure | main | #102 | diverge |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 44.5% (3563/8008) | 4.1% (327/8008) |
| charts more than half identical | 0/242 | 93/242 | 0/242 |
| line A: common / step / leap | 29.0% / 61.4% / 9.6% | 29.2% / 63.3% / 7.5% | 27.9% / 62.4% / 9.7% |
| line B: common / step / leap | 28.1% / 62.9% / 9.0% | 28.8% / 63.1% / 8.2% | 27.6% / 62.2% / 10.3% |
| moves > tritone: A / B / distinct chords | 7 / 7 / 14 | 11 / 8 / 12 | 37 / 49 / 86 |
| largest move (semitones) | 8 (whisper_not A1 8, B E4->Ab3) | 7 (everything_i_love B 9, B F2->C3) | 12 (antigua C 32, B G2->G3) |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 3320 / 3320 / 7 | 312 / 47 / 70 |

## Reading it

The variant fixes the coincidence: on every part the share of chords with both lines on one pitch falls from 44–63%
to 4–7% (the meeting chords themselves), and no chart is identical at more than half its chords. But it brings back
leaps, and more than the trade ever did: moves over a tritone (distinct chords) go from 18 on main and 14 on #102 to
114 on concert treble, with most of them (92) at the chord right after a meeting, and the largest move is now an
octave. The cause is the strictness of D1: the next chord often has the shared pitch as a common tone and its other
guide tone a tritone away, so "strictly above" and "strictly below" force one or both lines a tritone; D2 at the edge
of the range forces an octave (Bb Bb7 B Ebm Cm7: line A Eb5 → Eb4).

A softer D1 to consider: let one line keep the shared pitch when it is a common tone (the one whose strict move would
be larger) and send only the other away.
