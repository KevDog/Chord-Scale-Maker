# Guide tone lines that meet go apart: note

Date: 2026-10-11. Status: shipped (the user's choice, G8), on branch `guide-lines-diverge` (from
`independent-guide-lines`, PR #102), although strict diverge fails the significance test below. The gentle variant (G1–G3) is built and measured on
`guide-lines-gentle`: see "Gentle variant: measured" at the end. Amends [the independent-lines spec](2026-10-10-independent-guide-tone-lines-design.md),
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
| D1 | When the lines share a pitch at a chord, at the next new chord the line that was above before they met moves to the nearest in-range guide tone strictly above that pitch, the other to the nearest strictly below. Together since a restart (only possible if a chord's two guide tones share a pitch, so never with real symbols): line B (From 7th) goes up. | accepted by the user (shipped, G8) |
| D2 | With no in-range candidate on its side, a line takes its nearest candidate on the other side that is not its partner's (the partner on its own side chooses first). If none exists, they coincide again, and D1 applies at the next chord. | accepted by the user (shipped, G8) |
| D3 | Once apart, each line moves by rules 2–6 independently until they meet again. A held chord (rule 5) holds both lines on the shared pitch; they go apart at the first new chord. The same chord across a block boundary is a new chord, so they go apart there. Rests and restarts are as before (a rest ends the run; the restart is rule 1/6 for each line). | accepted by the user (shipped, G8) |
| P | **Placing a run.** At a line's start or restart (rule 1, and the rule 6 restart), instead of the chosen degree in the octave nearest the centre (rule 1) or nearest the last sounded note (rule 6): build the line's run alone (rules 2–5, no meetings) from each of the degree's octaves in range, up to the next rest, and keep the octave whose run's average pitch is nearest the centre; on a tie, the higher (compared exactly: the runs reach the same rest, so |sum − centre × length| orders them without rounding). Rules 2–6 are otherwise unchanged. Each line's run is placed, then D1–D3 apply as they meet. The placement looks ahead as far as the next rest, so rule 9's "no look-ahead" now means no loop and nothing past a rest. | approved by the user, 2026-10-11 |
| D4 | The public API stays `guideToneLine(tones, range, from, blocks?)`, returning one line (both are built internally). The diverge commit (f558165) changed nothing above the engine and moved no e2e or app expectation; the placement commit later moved three e2e expectations, and the help page gained a section (both listed below). | accepted by the user (shipped, G8) |

Tests: `web/engine/__tests__/guideToneLines.test.ts`, "lines that meet go apart" (D1 both directions, the restart
case, the floor and ceiling of D2, D2's "coincide again", D3 apart / held / block boundary / rest) and, over the
library for every part, "lines that share a pitch differ at the next new chord" (and only move to one side when the
other has no guide tone in range). The diverge commit moved no existing expected row.

Placement (P) has its own tests ("placing a run nearest the centre": A Song for Nicholas on vibes, line A from E5; a
run is weighed as it really goes, turned at the floor; a restart after a rest reads as the run alone; a tie takes the
higher, exactly, as on guitar doxy and clarinet misty from the 7th) and moved these rows,
all because a start or restart is now placed: rule 1's tie (Cm7 Eb4 → Eb5; bass Eb7 G2 → G3, the higher); rule 3.1 on
line B (F7 D7 now Eb5 → C5 rather than F#5); rule 4's floor examples (treble and vibes now G7 F7 Eb7 Db7 B7 A7 G7,
line A at C#4 turning up to F4, or down to B3 on vibes; bass now C7 Em7 Dbm7 Cm, line B Fb2 → C3); rule 6 (the restart
is placed, not nearest the last note: Dm7 ??? G7 ??? A7 line B F4, G4, was F5, G5); rule 9 (rewritten: what follows a
rest leaves a line alone); "each line on its own" (Cmaj7 Ebmaj7 line A E5 D5; F7 D7 and Cm6 D7 no longer meet, so
dropped from the meeting test; Cm Dm Bbm line A Eb5 D5 Bb4); D1–D3 rebased on Cm7 D7 and C7 A7 (F7 D7 no longer
meet); D2's toy case starts on C5. D2 also gained a toy case with no candidate at all in range: both lines rest there,
as a single line does, rather than fail. guideTones.test.ts: guideVoices' "on its own" example is now Fm7 GMaj7. e2e (the
expectations, and one fixture that no longer reached its note): the From 3rd label row (3 7 3 3 7 7 3 7);
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

## Significance (ruling G7)

Per chart over the 242 library charts, paired, #102 (894f679) against diverge+placement (adc4057), Wilcoxon
signed-rank, two-sided, alpha = 0.05. Normal approximation: zero differences dropped (Wilcoxon's method), average ranks
for ties with the tie-corrected variance, continuity correction 0.5; N is the charts with the measure defined (a chart
with no moves has no leap share), n the non-zero differences, W+ the rank sum where the variant is higher. The
smallest n (24, vibes and trumpet over-tritone counts) is near the limit where the normal approximation is usually
trusted. Scratch script: `scratchpad/diverge/sig.ts` (not in the repo).

| part | measure | N charts | n (non-zero) | W+ | W- | z | p | direction (variant vs #102) | mean per-chart diff | significant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| treble (concert) | (a) coincidence share | 242 | 190 | 126.5 | 18018.5 | -11.79 | 4.6e-32 | falls | -46.83 pts | yes |
| treble (concert) | (b) line A leap share (>2) | 242 | 125 | 5980.5 | 1894.5 | 5.03 | 4.8e-7 | rises | 1.70 pts | yes |
| treble (concert) | (b) line B leap share (>2) | 242 | 115 | 4299.5 | 2370.5 | 2.69 | 0.0071 | rises | 1.02 pts | yes |
| treble (concert) | (c) line A moves > tritone | 242 | 35 | 515 | 115 | 3.58 | 0.0003 | rises | 0.099 | yes |
| treble (concert) | (c) line B moves > tritone | 242 | 41 | 751.5 | 109.5 | 4.50 | 6.6e-6 | rises | 0.157 | yes |
| bass (concert) | (a) coincidence share | 242 | 196 | 144 | 19162 | -11.96 | 5.9e-33 | falls | -47.30 pts | yes |
| bass (concert) | (b) line A leap share (>2) | 242 | 117 | 5340 | 1563 | 5.14 | 2.8e-7 | rises | 1.87 pts | yes |
| bass (concert) | (b) line B leap share (>2) | 242 | 117 | 4569.5 | 2333.5 | 3.04 | 0.0024 | rises | 1.58 pts | yes |
| bass (concert) | (c) line A moves > tritone | 242 | 34 | 488 | 107 | 3.52 | 0.0004 | rises | 0.103 | yes |
| bass (concert) | (c) line B moves > tritone | 242 | 52 | 1208.5 | 169.5 | 5.18 | 2.2e-7 | rises | 0.182 | yes |
| vibes | (a) coincidence share | 242 | 179 | 370.5 | 15739.5 | -11.07 | 1.8e-28 | falls | -37.82 pts | yes |
| vibes | (b) line A leap share (>2) | 242 | 119 | 4883 | 2257 | 3.48 | 0.0005 | rises | 1.01 pts | yes |
| vibes | (b) line B leap share (>2) | 242 | 103 | 3736.5 | 1619.5 | 3.48 | 0.0005 | rises | 1.21 pts | yes |
| vibes | (c) line A moves > tritone | 242 | 26 | 267.5 | 83.5 | 2.51 | 0.0121 | rises | 0.066 | yes |
| vibes | (c) line B moves > tritone | 242 | 24 | 230.5 | 69.5 | 2.53 | 0.0116 | rises | 0.058 | yes |
| trumpet | (a) coincidence share | 242 | 182 | 707 | 15946 | -10.71 | 9.6e-27 | falls | -34.00 pts | yes |
| trumpet | (b) line A leap share (>2) | 242 | 103 | 4370 | 986 | 5.57 | 2.6e-8 | rises | 1.85 pts | yes |
| trumpet | (b) line B leap share (>2) | 242 | 113 | 4763.5 | 1677.5 | 4.42 | 9.9e-6 | rises | 1.88 pts | yes |
| trumpet | (c) line A moves > tritone | 242 | 24 | 267 | 33 | 3.58 | 0.0003 | rises | 0.091 | yes |
| trumpet | (c) line B moves > tritone | 242 | 40 | 766 | 54 | 5.22 | 1.8e-7 | rises | 0.161 | yes |

By the ruling, diverge passes only if (a) falls significantly on all four parts and neither (b) nor (c) rises
significantly on any. (a) falls on all four (p < 1e-26), but (b) and (c) rise significantly on every part and line
(p from 2.6e-8 to 0.012). **Strict diverge fails the test.** The user ships it anyway (strict diverge + placement + the help
section, this branch): lower coincidence matters more to them than fewer leaps. A gentler rule is to be tried after the
repo split; see "Next".

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

## Next: gentle variant, after the split

To try after the repo split, replacing D1 and D2 (D3, D4 and P unchanged), measured against #102 and strict
diverge+placement, with Wilcoxon on gentle against strict for coincidence and moves over a tritone. "At most a
tritone" means a move of 6 semitones or fewer; every candidate is inside the part's range (rule 4).

- **G1, a shared common tone.** When the lines share a pitch p at chord i and p is a guide tone of the next new
  chord, the keeper keeps p (struck again, or tied if the chord holds): the line that was below before they met, or
  line A (From 3rd) if they've been together since a restart. The mover goes to the chord's other guide tone: its
  nearest in-range octave in the mover's direction (up if it was above) if that is at most a tritone from p;
  otherwise its nearest in-range octave either way, if that is at most a tritone from p; otherwise G3.
- **G2, no common tone.** When p is not a guide tone of the next new chord, the line that was above takes its nearest
  in-range candidate strictly above p, the other its nearest strictly below, each only if that is at most a tritone
  from p. A line with no such candidate (none in range on its side, or the nearest more than a tritone away) takes
  its nearest candidate either way by rules 2–4, and the lines may coincide again.
- **G3, the range edge.** No line moves more than a tritone because of the other: where G1's mover has no octave of
  the other guide tone within a tritone of p, it stays on p with the keeper (they coincide, and G1 or G2 applies at
  the next new chord); where G2 sends a line to rules 2–4, it moves no further than it would alone.

## Gentle variant: measured

Built on branch `guide-lines-gentle` (from main a0f869d, after the repo split): G1–G3 in place of D1/D2, with P, D3
and D4 unchanged (`engine/src/guideToneLines.ts`). Interpretations made in building it: G1's mover is always the line
that was above, so "its direction" is up; a held chord after a meeting holds both lines (D3), so G1's keeper is struck
again at the first new chord, never tied; for G1 on a chord whose two guide tones share a pitch (only in toy cases), the
mover's candidates exclude the shared pitch itself, so it stays (G3) unless another octave is within a tritone.

Tests (`engine/src/__tests__/guideToneLines.test.ts`, "lines that meet go apart, gently (G1–G3)"): the common tone
kept by the line below (Cm7 D7 Dm7; D7 again in a new block, the mover a tritone up), the tritone cap on G1 (B7 Dm F
Dm7: C5 is 7 above F4, so C4) and on G2 (Cm7 D7 G: G5 is 7 above C5, so A moves as alone, to B4, with B), no common
tone (Cm7 D7 G7; C7 A7 Dm7), the range edge (G1 at the floor and ceiling; G2 at the ceiling, Cm Dm Bbm; G3 in a toy
C4–C5 range), together since a restart (A keeps; B goes up in G2), holds and rests. The library check now asserts,
for every part, that after a meeting one line keeps a common tone, the mover stays within a tritone (or stays, G3), no
line moves further than a tritone or than it would alone, and the lines are together again only when one had no room.
Moved expectations: Cm Dm Bbm line A (Bb4 → Db5, G2 at the ceiling); the D2 toy cases (now together, G3); e2e, the
vibes ledger-line chart, which no longer reached G3 (strict's F#4 → Bb3 leap at the Gm is gone; now Abm7 D7 Ebm7 Gbm7
Abm7 BbMaj7 Eb7 Bm7, G3 at the Eb7), and one comment (the From 3rd label row's meeting is now G2; the row is
unchanged). No golden change.

Columns: **#102** (894f679, each line alone, no diverge or placement, its `guideToneLines.ts` taken from git
history), **strict** (a0f869d: D1–D4 and P, as shipped), **gentle** (this branch). Same library and sequence as above
(242 charts, 8008 chords, the sheet's order, folds and blocks), with the current engine's guide tones for all three.
The last row: meetings followed by a new chord (not held), of them the lines together again, one line kept the shared
pitch (G1), and either line moving more than a tritone from it. Scratch scripts: `scratchpad/gentle/` (measure.ts,
sig.ts, common.ts); `npm run guide-lines -w engine` now also prints the distinct count and the meeting row.

#### treble (concert) (range 60-81, centre 69)

| measure | #102 (894f679) | strict (a0f869d) | gentle |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 63.1% (5051/8008) | 5.4% (433/8008) | 6.2% (500/8008) |
| charts more than half identical | 140/242 | 0/242 | 0/242 |
| line A: common / step / leap | 28.4% / 62.1% / 9.5% | 27.6% / 61.4% / 11.0% | 28.0% / 61.2% / 10.8% |
| line B: common / step / leap | 27.7% / 62.2% / 10.1% | 27.5% / 61.7% / 10.8% | 27.7% / 62.2% / 10.1% |
| moves > tritone: A / B / distinct chords | 13 / 11 / 14 | 37 / 49 / 85 | 4 / 5 / 9 |
| largest move (semitones) | 7 (autumn_leaves A1 7, A C4->G4) | 12 (baby_steps B 24, B E4->E5) | 7 (jeannine A3 41, B Db4->Ab4) |
| line A: mean of chart means (centre 69) | 66.5 | 69.5 | 69.6 |
| line B: mean of chart means (centre 69) | 66.3 | 68.2 | 68.4 |
| line A: charts averaging > M3 below centre | 101/242 | 36/242 | 37/242 |
| line B: charts averaging > M3 below centre | 108/242 | 54/242 | 51/242 |
| meetings followed by a new chord / together again / one kept the pitch / a move > tritone | 4736 / 4736 / 0 / 10 | 416 / 0 / 0 / 71 | 479 / 33 / 110 / 0 |

#### bass (concert) (range 40-60, centre 49)

| measure | #102 (894f679) | strict (a0f869d) | gentle |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 63.0% (5049/8008) | 5.3% (423/8008) | 6.0% (480/8008) |
| charts more than half identical | 138/242 | 0/242 | 0/242 |
| line A: common / step / leap | 28.3% / 62.9% / 8.8% | 26.6% / 62.6% / 10.9% | 27.1% / 62.4% / 10.5% |
| line B: common / step / leap | 28.0% / 62.5% / 9.5% | 27.5% / 61.6% / 10.9% | 28.0% / 61.7% / 10.2% |
| moves > tritone: A / B / distinct chords | 18 / 15 / 20 | 43 / 59 / 102 | 7 / 9 / 16 |
| largest move (semitones) | 8 (the_things_we_did_last_summer A2 16, B C4->Fb3) | 12 (along_came_betty C 21, A G2->G3) | 8 (the_things_we_did_last_summer A2 16, A C4->Fb3) |
| line A: mean of chart means (centre 49) | 46.1 | 49.0 | 48.9 |
| line B: mean of chart means (centre 49) | 46.2 | 48.2 | 48.1 |
| line A: charts averaging > M3 below centre | 108/242 | 39/242 | 41/242 |
| line B: charts averaging > M3 below centre | 110/242 | 47/242 | 58/242 |
| meetings followed by a new chord / together again / one kept the pitch / a move > tritone | 4724 / 4724 / 0 / 13 | 404 / 0 / 0 / 85 | 454 / 25 / 111 / 0 |

#### vibes (range 55-86, centre 70)

| measure | #102 (894f679) | strict (a0f869d) | gentle |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 51.1% (4096/8008) | 3.3% (266/8008) | 4.1% (327/8008) |
| charts more than half identical | 109/242 | 0/242 | 0/242 |
| line A: common / step / leap | 29.3% / 63.0% / 7.7% | 28.1% / 63.4% / 8.5% | 28.5% / 63.3% / 8.2% |
| line B: common / step / leap | 28.9% / 63.1% / 8.1% | 27.9% / 63.1% / 9.0% | 28.2% / 63.1% / 8.7% |
| moves > tritone: A / B / distinct chords | 14 / 13 / 14 | 30 / 27 / 56 | 6 / 6 / 12 |
| largest move (semitones) | 8 (body_and_soul A2 13, A G3->Eb4) | 12 (everything_i_love D 28, B Cb4->Cb5) | 8 (body_and_soul A2 13, B G3->Eb4) |
| line A: mean of chart means (centre 70) | 65.8 | 70.2 | 70.5 |
| line B: mean of chart means (centre 70) | 65.7 | 69.3 | 69.6 |
| line A: charts averaging > M3 below centre | 129/242 | 45/242 | 38/242 |
| line B: charts averaging > M3 below centre | 132/242 | 64/242 | 59/242 |
| meetings followed by a new chord / together again / one kept the pitch / a move > tritone | 3825 / 3825 / 0 / 13 | 258 / 0 / 0 / 45 | 314 / 28 / 81 / 0 |

#### trumpet (range 55-79, centre 70)

| measure | #102 (894f679) | strict (a0f869d) | gentle |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 46.5% (3724/8008) | 4.3% (347/8008) | 5.7% (457/8008) |
| charts more than half identical | 101/242 | 0/242 | 0/242 |
| line A: common / step / leap | 29.0% / 63.2% / 7.9% | 28.0% / 62.3% / 9.7% | 28.7% / 61.9% / 9.4% |
| line B: common / step / leap | 28.6% / 62.8% / 8.6% | 27.9% / 62.1% / 10.1% | 27.8% / 62.6% / 9.5% |
| moves > tritone: A / B / distinct chords | 10 / 8 / 11 | 32 / 47 / 78 | 5 / 5 / 10 |
| largest move (semitones) | 7 (everything_i_love B 9, B G3->D4) | 12 (all_the_things_you_are C 31, B C4->C5) | 7 (in_a_sentimental_mood A1 3, A G5->C5) |
| line A: mean of chart means (centre 70) | 64.9 | 67.8 | 68.5 |
| line B: mean of chart means (centre 70) | 65.2 | 67.5 | 68.0 |
| line A: charts averaging > M3 below centre | 145/242 | 88/242 | 71/242 |
| line B: charts averaging > M3 below centre | 137/242 | 96/242 | 81/242 |
| meetings followed by a new chord / together again / one kept the pitch / a move > tritone | 3469 / 3469 / 0 / 7 | 331 / 0 / 0 / 65 | 434 / 62 / 103 / 0 |

#### tenor sax (range 58-84, centre 68)

| measure | #102 (894f679) | strict (a0f869d) | gentle |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 56.9% (4557/8008) | 4.6% (371/8008) | 5.2% (414/8008) |
| charts more than half identical | 122/242 | 0/242 | 0/242 |
| line A: common / step / leap | 29.0% / 62.3% / 8.6% | 28.0% / 62.2% / 9.8% | 28.2% / 62.5% / 9.4% |
| line B: common / step / leap | 28.9% / 61.8% / 9.3% | 27.6% / 62.2% / 10.2% | 28.2% / 62.3% / 9.5% |
| moves > tritone: A / B / distinct chords | 8 / 10 / 10 | 28 / 34 / 62 | 4 / 5 / 9 |
| largest move (semitones) | 8 (nardis A1 8, B Bb3->F#4) | 12 (a_weaver_of_dreams A2 22, B D4->D5) | 8 (nardis A3 32, A Bb3->F#4) |
| line A: mean of chart means (centre 68) | 64.9 | 68.6 | 68.8 |
| line B: mean of chart means (centre 68) | 64.9 | 67.7 | 67.7 |
| line A: charts averaging > M3 below centre | 119/242 | 32/242 | 29/242 |
| line B: charts averaging > M3 below centre | 127/242 | 44/242 | 46/242 |
| meetings followed by a new chord / together again / one kept the pitch / a move > tritone | 4270 / 4270 / 0 / 8 | 345 / 0 / 0 / 54 | 382 / 17 / 92 / 0 |

#### trombone (range 40-64, centre 56)

| measure | #102 (894f679) | strict (a0f869d) | gentle |
| --- | --- | --- | --- |
| chords where both lines share a pitch | 44.5% (3563/8008) | 4.4% (350/8008) | 6.5% (521/8008) |
| charts more than half identical | 93/242 | 0/242 | 2/242 |
| line A: common / step / leap | 29.2% / 63.3% / 7.5% | 28.1% / 61.6% / 10.3% | 28.8% / 61.4% / 9.8% |
| line B: common / step / leap | 28.8% / 63.1% / 8.2% | 27.4% / 62.6% / 10.0% | 27.5% / 62.6% / 9.9% |
| moves > tritone: A / B / distinct chords | 11 / 8 / 12 | 49 / 53 / 100 | 7 / 9 / 16 |
| largest move (semitones) | 7 (everything_i_love B 9, B F2->C3) | 12 (antigua C 32, A G2->G3) | 8 (caravan A1 13, A E4->Ab3) |
| line A: mean of chart means (centre 56) | 50.8 | 53.1 | 53.8 |
| line B: mean of chart means (centre 56) | 51.0 | 53.4 | 53.7 |
| line A: charts averaging > M3 below centre | 145/242 | 104/242 | 82/242 |
| line B: charts averaging > M3 below centre | 137/242 | 98/242 | 86/242 |
| meetings followed by a new chord / together again / one kept the pitch / a move > tritone | 3320 / 3320 / 0 / 7 | 335 / 0 / 0 / 84 | 498 / 97 / 147 / 0 |

### Significance: gentle against strict

Per chart, paired, strict (a0f869d) against gentle, Wilcoxon signed-rank, two-sided, alpha = 0.05, the method above
(normal approximation, zeros dropped, tie-corrected variance, continuity correction 0.5). W+ is the rank sum where
gentle is higher.

| part | measure | N charts | n (non-zero) | W+ | W- | z | p | direction (gentle vs strict) | mean per-chart diff | significant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| treble (concert) | coincidence share | 242 | 43 | 908 | 38 | 5.25 | 1.5e-7 | rises | 0.70 pts | yes |
| treble (concert) | line A moves > tritone | 242 | 30 | 0 | 465 | -5.25 | 1.5e-7 | falls | -0.136 | yes |
| treble (concert) | line B moves > tritone | 242 | 36 | 0 | 666 | -5.68 | 1.4e-8 | falls | -0.182 | yes |
| treble (concert) | chords with a move > tritone (distinct) | 242 | 59 | 0 | 1770 | -7.10 | 1.2e-12 | falls | -0.314 | yes |
| bass (concert) | coincidence share | 242 | 45 | 919 | 116 | 4.53 | 6.0e-6 | rises | 0.64 pts | yes |
| bass (concert) | line A moves > tritone | 242 | 31 | 0 | 496 | -5.28 | 1.3e-7 | falls | -0.149 | yes |
| bass (concert) | line B moves > tritone | 242 | 48 | 22.5 | 1153.5 | -6.43 | 1.3e-10 | falls | -0.207 | yes |
| bass (concert) | chords with a move > tritone (distinct) | 242 | 63 | 0 | 2016 | -7.22 | 5.2e-13 | falls | -0.355 | yes |
| vibes | coincidence share | 242 | 31 | 483 | 13 | 4.60 | 4.3e-6 | rises | 0.68 pts | yes |
| vibes | line A moves > tritone | 242 | 21 | 0 | 231 | -4.39 | 1.1e-5 | falls | -0.099 | yes |
| vibes | line B moves > tritone | 242 | 20 | 0 | 210 | -4.36 | 1.3e-5 | falls | -0.087 | yes |
| vibes | chords with a move > tritone (distinct) | 242 | 39 | 0 | 780 | -5.98 | 2.2e-9 | falls | -0.182 | yes |
| trumpet | coincidence share | 242 | 44 | 966 | 24 | 5.49 | 4.0e-8 | rises | 1.28 pts | yes |
| trumpet | line A moves > tritone | 242 | 24 | 0 | 300 | -4.65 | 3.3e-6 | falls | -0.112 | yes |
| trumpet | line B moves > tritone | 242 | 38 | 0 | 741 | -5.90 | 3.7e-9 | falls | -0.174 | yes |
| trumpet | chords with a move > tritone (distinct) | 242 | 57 | 0 | 1653 | -7.07 | 1.6e-12 | falls | -0.281 | yes |

### Reading it

**Leaps: gone.** Moves over a tritone fall on every part and line, significantly (p from 1.3e-5 to 5e-13): concert
treble from 85 distinct chords (strict) to 9, below #102's 14; the largest move is 7 or 8 semitones again on every part
(strict: 12), and no move after a meeting exceeds a tritone (strict: 45–85 per part). Leap shares fall slightly, toward
#102's; step and common-tone shares barely move.

**Coincidence: slightly up, still low.** The share of chords with both lines on one pitch rises significantly but by
little: treble 5.4% → 6.2%, bass 5.3% → 6.0%, vibes 3.3% → 4.1%, trumpet 4.3% → 5.7% (mean per-chart rise 0.6–1.3
points; #102 was 44–63%). Two things add to it: the lines meet a little more often (treble 479 meetings against 416),
and G2's fallback, or G3, leaves them together again at some (treble 33 of 479; trombone, in its narrow range, 97 of
498, with 2 of 242 charts more than half identical: a_song_for_nicholas 7/12, sugar 9/16). Tenor sax and trombone, outside the test, follow the same pattern.

**Height:** unchanged or a little better than strict (trumpet's low charts 88 / 96 → 71 / 81; trombone 104 / 98 → 82 /
86; bass line B 47 → 58 is the one step back).

**Verdict.** Gentle keeps coincidence near strict's (within about a point, a tenth of #102's) while cutting the leaps
over a tritone by 79–89% (distinct chords, the six parts), to fewer than #102 had. The coincidence rise is statistically significant but small; the
leap fall is large.
