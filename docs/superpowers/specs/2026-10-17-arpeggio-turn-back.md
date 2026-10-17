# 7th Chords line: turn back in a 3/4 bar (#348)

## Problem

The 7th Chords line fills a chord's slots by repeating its four-note pattern from the start (arpeggios spec, rule 3).
A 3/4 bar of one chord has six eighths, so it played `1 3 5 7 1 3`: beat 3 restarted the arpeggio and left a fragment
hanging into the next chord. Every jazz waltz in the library has it (Waltz for Debby: one chord in nearly every bar).
4/4 and 2/4 splits, and 3/4 bars of two or three chords, divide evenly and are unaffected.

## Rule

After a bar's last whole cell, the *r* remaining slots (1 ≤ *r* ≤ 3) play that cell's notes in reverse from its
second-to-last: `1 3 5 7 5 3` in 3/4.

- Its pitches are the cell's own, so it stays in range.
- The next cell is placed nearest the turn-back's last note (rule 4, unchanged); Voice-led measures from it too.
- It is not an arpeggio of its own: Up & down's alternation and the chord's cell count don't advance.
- A chord held over several bars starts its pattern again in each bar, as before.
- A bar with too few slots for one whole cell plays the cell cut short, as before.

| Bar (3/4, one chord) | Before | After |
|---|---|---|
| FMaj7/A | F A C E F A | F A C E C A |
| Dm7 | D F A C D F | D F A C A F |
| C7, Down · root | Bb G E C Bb G | Bb G E C E G |
| Gm7b5, Up · 2nd inv | Db F G Bb Db F | Db F G Bb G F |
| F (triad) | F A C F F A | F A C F C A |

## Scope

`Cells.turn` (opt-in), honoured by `cellVoices`; `arpeggioCells` sets it. The Pentatonic and Triad Pair lines'
7th chord fallback uses `arpeggioCells`, so it turns back too and the sheets agree; their own cells don't (triad
pairs keep `carry`).

## Rejected

- **Eighth-note triplets in 3/4:** nine slots against a four-note cell make a 4-against-3 cross-rhythm, the bar still
  ends on a fragment, and written triplets read as a literal 9/8 feel.
- **Four eighths and a quarter:** breaks rule 2 (one note value per bar) and the beaming.
