# Guide tone lines that meet go apart: note

Date: 2026-10-11. Status: built on branch `guide-lines-diverge` (from `independent-guide-lines`, PR #102) for the
user to compare; not merged. Amends [the independent-lines spec](2026-10-10-independent-guide-tone-lines-design.md),
which keeps rules 1–6 and 8–10 of [the guide tone lines spec](2026-10-10-guide-tone-lines-design.md) and drops rule 7.

## Why

Built on its own, each line remembers only its last note, so once the two lines land on one pitch they stay identical
until the next rest. On PR #102, concert treble, 63% of voiced chords have both lines on one pitch and 140 of 242
charts are identical at more than half their chords. The user's idea: when they come together, send one up and one
down on the next note.

## The rules as built (`web/engine/guideToneLines.ts`)

Both lines are built together again, but only so they can go apart after meeting; otherwise each moves by rules 1–6
on its own.

| | Ruling | Status |
| --- | --- | --- |
| D1 | When the lines share a pitch at a chord, at the next new chord the line that was above before they met moves to the nearest in-range guide tone strictly above that pitch, the other to the nearest strictly below. Together since a restart (only possible if a chord's two guide tones share a pitch, so never with real symbols): line B (From 7th) goes up. | assumed (confirm) |
| D2 | With no in-range candidate on its side, a line takes its nearest candidate on the other side that is not its partner's (the partner on its own side chooses first). If none exists, they coincide again, and D1 applies at the next chord. | assumed (confirm) |
| D3 | Once apart, each line moves by rules 2–6 independently until they meet again. A held chord (rule 5) holds both lines on the shared pitch; they go apart at the first new chord. The same chord across a block boundary is a new chord, so they go apart there. Rests and restarts are as before (a rest ends the run; the restart is rule 1/6 for each line). | assumed (confirm) |
| P | **Placing a run.** At a line's start or restart (rule 1, and the rule 6 restart), instead of the chosen degree in the octave nearest the centre (rule 1) or nearest the last sounded note (rule 6): build the line's run alone (rules 2–5, no meetings) from each of the degree's octaves in range, up to the next rest, and keep the octave whose run's average pitch is nearest the centre; on a tie, the higher. Rules 2–6 are otherwise unchanged. Each line's run is placed, then D1–D3 apply as they meet. The placement looks ahead as far as the next rest, so rule 9's "no look-ahead" now means no loop and nothing past a rest. | approved by the user, 2026-10-11 |
| D4 | The public API stays `guideToneLine(tones, range, from, blocks?)`, returning one line (both are built internally). Nothing above the engine changed; no e2e or app expectation moved. | assumed (confirm) |

Tests: `web/engine/__tests__/guideToneLines.test.ts`, "lines that meet go apart" (D1 both directions, the restart
case, the floor and ceiling of D2, D2's "coincide again", D3 apart / held / block boundary / rest) and, over the
library for every part, "lines that share a pitch differ at the next new chord" (and only move to one side when the
other has no guide tone in range). The diverge commit moved no existing expected row.

Placement (P) has its own tests ("placing a run nearest the centre": A Song for Nicholas on vibes, line A from E5; a
placed run stays in range; a restart after a rest reads as the run alone; a tie takes the higher) and moved these rows,
all because a start or restart is now placed: rule 1's tie (Cm7 Eb4 → Eb5; bass Eb7 G2 → G3, the higher); rule 3.1 on
line B (F7 D7 now Eb5 → C5 rather than F#5); rule 4's floor examples (treble and vibes now G7 F7 Eb7 Db7 B7 A7 G7,
line A at C#4 turning up to F4, or down to B3 on vibes; bass now C7 Em7 Dbm7 Cm, line B Fb2 → C3); rule 6 (the restart
is placed, not nearest the last note: Dm7 ??? G7 ??? A7 line B F4, G4, was F5, G5); rule 9 (rewritten: what follows a
rest leaves a line alone); "each line on its own" (Cmaj7 Ebmaj7 line A E5 D5; F7 D7 and Cm6 D7 no longer meet, so
dropped from the meeting test; Cm Dm Bbm line A Eb5 D5 Bb4); D1–D3 rebased on Cm7 D7 and C7 A7 (F7 D7 no longer
meet); D2's toy case starts on C5. guideTones.test.ts: guideVoices' "on its own" example is now Fm7 GMaj7. e2e (the
expectations only, and two fixtures that no longer reached their notes): the From 3rd label row (3 7 3 3 7 7 3 7);
the vibes ledger-line chart (now Bm E DMaj7 Gm Cm7 Bb7 Am7 G7, down to G3 at the Am7); the tuba print case accepts
C3 as the From 3rd line's lowest note (From 7th still reaches G2).

## Measurement

The library (242 charts, 8008 chords) voiced as the Changes sheet voices it (written order, folded repeats drawn once,
blocks for holds; the chord sequence of `npm run guide-lines`). Columns: **main** (0814306: the paired lines, rule 7
with the trade), **#102** (894f679: each line alone), **diverge** (f558165: D1–D4), **diverge+placement** (this
branch: D1–D4 and P). A move is between consecutive voiced chords of one line within a run; "distinct" counts chords
where either line moves more than a tritone. Height: the mean over charts of each chart's mean pitch (midi), and the
charts whose mean is more than a major 3rd (4 semitones) below the centre. The last row counts the chords right after
a meeting (not held): how many, how many where the lines did not end on opposite sides (on #102: they stayed together;
on the variants: D2 fired), and how many of those moves exceed a tritone. (The reviewer's 63.2% / 139 for #102 used
the chart's rows without folds or blocks; the sheet's sequence gives 63.1% / 140.)

### treble (concert) (range 60-81, centre 69)

| measure | main | #102 | diverge | diverge+placement |
| --- | --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 63.1% (5051/8008) | 6.6% (525/8008) | 5.4% (433/8008) |
| charts more than half identical | 0/242 | 140/242 | 0/242 | 0/242 |
| line A: common / step / leap | 28.7% / 60.5% / 10.8% | 28.4% / 62.1% / 9.5% | 28.0% / 60.6% / 11.4% | 27.6% / 61.4% / 11.0% |
| line B: common / step / leap | 27.1% / 61.0% / 11.9% | 27.7% / 62.2% / 10.1% | 26.3% / 60.9% / 12.7% | 27.5% / 61.7% / 10.8% |
| moves > tritone: A / B / distinct chords | 7 / 12 / 18 | 13 / 11 / 14 | 39 / 75 / 114 | 37 / 49 / 85 |
| largest move (semitones) | 9 (smatter B 13, A G5->Bb4) | 7 (autumn_leaves A1 7, A C4->G4) | 12 (baby_steps Intro 16, A E4->E5) | 12 (baby_steps B 24, B E4->E5) |
| line A: mean of chart means (centre 69) | 68.1 | 66.5 | 68.0 | 69.5 |
| line B: mean of chart means (centre 69) | 67.0 | 66.3 | 67.4 | 68.2 |
| line A: charts averaging > M3 below centre | 58/242 | 101/242 | 64/242 | 36/242 |
| line B: charts averaging > M3 below centre | 100/242 | 108/242 | 74/242 | 54/242 |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 4736 / 4736 / 10 | 505 / 55 / 92 | 416 / 41 / 71 |

### bass (concert) (range 40-60, centre 49)

| measure | main | #102 | diverge | diverge+placement |
| --- | --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 63.0% (5049/8008) | 6.3% (506/8008) | 5.3% (423/8008) |
| charts more than half identical | 0/242 | 138/242 | 0/242 | 0/242 |
| line A: common / step / leap | 28.5% / 60.8% / 10.7% | 28.3% / 62.9% / 8.8% | 27.3% / 61.3% / 11.4% | 26.6% / 62.6% / 10.9% |
| line B: common / step / leap | 28.1% / 59.7% / 12.1% | 28.0% / 62.5% / 9.5% | 26.6% / 61.1% / 12.3% | 27.5% / 61.6% / 10.9% |
| moves > tritone: A / B / distinct chords | 11 / 11 / 22 | 18 / 15 / 20 | 63 / 58 / 121 | 43 / 59 / 102 |
| largest move (semitones) | 7 (beatrice A 7, A F2->C3) | 8 (the_things_we_did_last_summer A2 16, B C4->Fb3) | 12 (a_night_in_tunisia B 24, A G2->G3) | 12 (along_came_betty C 21, A G2->G3) |
| line A: mean of chart means (centre 49) | 47.6 | 46.1 | 47.8 | 49.0 |
| line B: mean of chart means (centre 49) | 47.2 | 46.2 | 47.4 | 48.2 |
| line A: charts averaging > M3 below centre | 82/242 | 108/242 | 60/242 | 39/242 |
| line B: charts averaging > M3 below centre | 95/242 | 110/242 | 72/242 | 47/242 |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 4724 / 4724 / 13 | 481 / 82 / 100 | 404 / 67 / 85 |

### vibes (range 55-86, centre 70)

| measure | main | #102 | diverge | diverge+placement |
| --- | --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 51.1% (4096/8008) | 4.2% (336/8008) | 3.3% (266/8008) |
| charts more than half identical | 0/242 | 109/242 | 0/242 | 0/242 |
| line A: common / step / leap | 28.4% / 62.1% / 9.5% | 29.3% / 63.0% / 7.7% | 28.0% / 62.3% / 9.7% | 28.1% / 63.4% / 8.5% |
| line B: common / step / leap | 28.2% / 62.7% / 9.1% | 28.9% / 63.1% / 8.1% | 27.6% / 62.5% / 9.9% | 27.9% / 63.1% / 9.0% |
| moves > tritone: A / B / distinct chords | 9 / 9 / 18 | 14 / 13 / 14 | 33 / 49 / 82 | 30 / 27 / 56 |
| largest move (semitones) | 8 (body_and_soul A2 13, A G3->Eb4) | 8 (body_and_soul A2 13, A G3->Eb4) | 12 (a_weaver_of_dreams A1 15, A C4->C5) | 12 (everything_i_love D 28, B Cb4->Cb5) |
| line A: mean of chart means (centre 70) | 66.8 | 65.8 | 67.0 | 70.2 |
| line B: mean of chart means (centre 70) | 65.9 | 65.7 | 66.3 | 69.3 |
| line A: charts averaging > M3 below centre | 115/242 | 129/242 | 112/242 | 45/242 |
| line B: charts averaging > M3 below centre | 133/242 | 132/242 | 125/242 | 64/242 |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 3825 / 3825 / 13 | 321 / 37 / 68 | 258 / 20 / 45 |

### trumpet (range 55-79, centre 70)

| measure | main | #102 | diverge | diverge+placement |
| --- | --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 46.5% (3724/8008) | 4.6% (367/8008) | 4.3% (347/8008) |
| charts more than half identical | 0/242 | 101/242 | 0/242 | 0/242 |
| line A: common / step / leap | 28.2% / 61.9% / 9.9% | 29.0% / 63.2% / 7.9% | 28.0% / 62.2% / 9.8% | 28.0% / 62.3% / 9.7% |
| line B: common / step / leap | 27.9% / 62.3% / 9.8% | 28.6% / 62.8% / 8.6% | 27.5% / 61.6% / 10.9% | 27.9% / 62.1% / 10.1% |
| moves > tritone: A / B / distinct chords | 7 / 5 / 12 | 10 / 8 / 11 | 32 / 30 / 61 | 32 / 47 / 78 |
| largest move (semitones) | 8 (in_walked_bud A3 26, A Bb3->F#4) | 7 (everything_i_love B 9, B G3->D4) | 12 (all_the_things_you_are B 22, A B3->B4) | 12 (all_the_things_you_are C 31, B C4->C5) |
| line A: mean of chart means (centre 70) | 65.9 | 64.9 | 66.1 | 67.8 |
| line B: mean of chart means (centre 70) | 65.0 | 65.2 | 65.3 | 67.5 |
| line A: charts averaging > M3 below centre | 130/242 | 145/242 | 127/242 | 88/242 |
| line B: charts averaging > M3 below centre | 141/242 | 137/242 | 136/242 | 96/242 |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 3469 / 3469 / 7 | 348 / 18 / 46 | 331 / 38 / 65 |

### tenor sax (range 58-84, centre 68)

| measure | main | #102 | diverge | diverge+placement |
| --- | --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 56.9% (4557/8008) | 6.0% (482/8008) | 4.6% (371/8008) |
| charts more than half identical | 0/242 | 122/242 | 0/242 | 0/242 |
| line A: common / step / leap | 27.5% / 62.3% / 10.3% | 29.0% / 62.3% / 8.6% | 26.5% / 62.2% / 11.3% | 28.0% / 62.2% / 9.8% |
| line B: common / step / leap | 28.6% / 60.1% / 11.3% | 28.9% / 61.8% / 9.3% | 27.8% / 60.4% / 11.8% | 27.6% / 62.2% / 10.2% |
| moves > tritone: A / B / distinct chords | 3 / 11 / 14 | 8 / 10 / 10 | 40 / 52 / 92 | 28 / 34 / 62 |
| largest move (semitones) | 8 (dance_of_the_infidels A 9, B Db4->A4) | 8 (nardis A1 8, B Bb3->F#4) | 12 (a_weaver_of_dreams A2 22, A D4->D5) | 12 (a_weaver_of_dreams A2 22, B D4->D5) |
| line A: mean of chart means (centre 68) | 66.4 | 64.9 | 66.5 | 68.6 |
| line B: mean of chart means (centre 68) | 65.5 | 64.9 | 65.9 | 67.7 |
| line A: charts averaging > M3 below centre | 80/242 | 119/242 | 69/242 | 32/242 |
| line B: charts averaging > M3 below centre | 105/242 | 127/242 | 85/242 | 44/242 |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 4270 / 4270 / 8 | 450 / 61 / 80 | 345 / 29 / 54 |

### trombone (range 40-64, centre 56)

| measure | main | #102 | diverge | diverge+placement |
| --- | --- | --- | --- | --- |
| chords where both lines share a pitch | 0.0% (0/8008) | 44.5% (3563/8008) | 4.1% (327/8008) | 4.4% (350/8008) |
| charts more than half identical | 0/242 | 93/242 | 0/242 | 0/242 |
| line A: common / step / leap | 29.0% / 61.4% / 9.6% | 29.2% / 63.3% / 7.5% | 27.9% / 62.4% / 9.7% | 28.1% / 61.6% / 10.3% |
| line B: common / step / leap | 28.1% / 62.9% / 9.0% | 28.8% / 63.1% / 8.2% | 27.6% / 62.2% / 10.3% | 27.4% / 62.6% / 10.0% |
| moves > tritone: A / B / distinct chords | 7 / 7 / 14 | 11 / 8 / 12 | 37 / 49 / 86 | 49 / 53 / 100 |
| largest move (semitones) | 8 (whisper_not A1 8, B E4->Ab3) | 7 (everything_i_love B 9, B F2->C3) | 12 (antigua C 32, B G2->G3) | 12 (antigua C 32, A G2->G3) |
| line A: mean of chart means (centre 56) | 51.5 | 50.8 | 51.7 | 53.1 |
| line B: mean of chart means (centre 56) | 50.7 | 51.0 | 51.3 | 53.4 |
| line A: charts averaging > M3 below centre | 143/242 | 145/242 | 134/242 | 104/242 |
| line B: charts averaging > M3 below centre | 145/242 | 137/242 | 137/242 | 98/242 |
| meetings followed by a new chord / of them, not apart (#102) or on one side (D2) / a move > tritone | 0 / 0 / 0 | 3320 / 3320 / 7 | 312 / 47 / 70 | 335 / 63 / 84 |

## Reading it

**Coincidence: fixed.** On every part the share of chords with both lines on one pitch falls from 44–63% (#102) to
3–7% (the meeting chords themselves), and no chart is identical at more than half its chords.

**Leaps: back, and worse than the trade.** Moves over a tritone (distinct chords, concert treble) are 18 on main, 14
on #102, 114 with diverge and 85 with diverge+placement; the largest move is now an octave on every part (main: 7–9).
Most of them come right after a meeting (treble: 92 of 114; 71 of 85). The cause is the strictness of D1: the next
chord often has the shared pitch as a common tone and its other guide tone a tritone away, so "strictly above" and
"strictly below" force a tritone; D2 at the edge of the range forces an octave (Bb Bb7 B Ebm Cm7: line A Eb5 → Eb4).
Step shares are close across all four (60–63%); the common-tone share drops about a point with diverge.

**Height: placement works.** Lines no longer sink: on vibes the mean of chart means rises from 65.8 (#102) to 70.2 /
69.3 against a centre of 70, and the charts averaging more than a major 3rd low fall from 129 / 132 to 45 / 64; treble,
bass and tenor sax land within a semitone of their centres. Trumpet and trombone improve least (88–104 charts still
low), their centres sitting high in narrow ranges. Placement also trims diverge's leaps on treble, bass, vibes and tenor
(it adds some on trumpet and trombone).

A softer D1 to consider: let one line keep the shared pitch when it is a common tone (the one whose strict move would
be larger) and send only the other away; and at the range's edge (D2), let the line with no room hold rather than leap
an octave.
