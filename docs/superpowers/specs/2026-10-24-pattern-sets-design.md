# Pattern sets: a groove under the changes (#509, #540)

Roadmap Phase 4. Hear changes (#508) holds each chord on the piano and plays roots on the bass; this phase plays the
chart in a style: drums, a comping piano and a walking bass, chosen by the chart's `style:`.

## Decided (on autopilot; the owner may revisit)

- **Staged, one PR each:** the drum kit (#540, #586); the Swing set (this); the Ballad and Bossa sets; the mixer (level
  and mute per track, duo presets); practice tools (tempo ramp, all twelve keys). Each set ships behind its own flag:
  `grooveSwing`, `grooveBallad`, `grooveBossa`, off until the owner signs it off.
- **Kit (#540):** VCSL one-shots, CC0 (`/sounds/drums/`, 384 KB): ride, a soft ride (velocity under 0.5), bell, hat foot,
  hat tip, open hat, cross-stick, kick. Brushes (a sweep and a tap) are synthesized: no CC0 brush set was found.
- **styles.json** (`engine/styles.json`): each library style, lowercased, → its set, tempo (the click's `defaultTempo`)
  and swing. A style it doesn't list goes by its words: ballad → Ballad; Latin, bossa, samba → Bossa; else Swing.
  Swing 0.67; a shuffle 0.72; bossa, Latin, samba, even, straight, funk, rock 0.5. The Swing dial starts there
  (decision `groove.style`) and follows the style until the user moves it.
- **Reproducible:** every choice draws from mulberry32 seeded by the chart's title (FNV-1a), so a chart plays the same
  groove every time, and the tests can pin it.
- **Swing set** (decision `groove.swing`), pure in `engine/src/grooves.ts`:
  - drums: the ride on each beat, a skip note after 2 and 4 (after 2 in 3/4), 2 and 4 louder; the hat's foot on 2 and 4
    (2 and 3 in 3/4). The skip note is booked as an 8th off the beat, so it swings with the dial (`scheduleDrums`).
  - comping: each chord's voicing (#508's, `voicedSpans`) struck in a rhythm drawn per chord from a small table by the
    chord's length (the Charleston, 2 and 4, anticipations), never held past the chord.
  - walking bass, E1–G3: the root (a slash chord's bass) on the chord's first beat; its last a half step from the next
    chord's root (two times in three) or that root's 5th; the beats between step through the chord's scale toward it,
    chord tones twice as likely, no step more than a 4th. The form's last bar leads into its first. A 3/4 bar plays the
    root for two beats and a lead-in on 3; a chord shorter than two beats plays its root.
- **Controls:** under the click's ⋯, with Piano and Bass, when the style's set has shipped: **Swing groove**
  (checkbox), and with it **Drums**. With the groove on, Piano comps and Bass walks in place of held chords and roots
  (Bass Off still silences it). Remembered in `csm-click`. Start waits for the kit as for the other sets.
- **No playback marker exists**, so #509's "hide the marker" has nothing to hide; it is dropped.

## Left for later

- Ballad (brushes, two-feel, sustained piano) and Bossa (cross-stick pattern, bossa bass, syncopated comp) sets.
- Mixer and practice tools (above).
- Fills and variation at section ends; a jazz-waltz comping table of its own.
