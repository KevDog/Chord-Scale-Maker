# Sampled sounds: provenance

Every recorded sound the app plays lives in `web/public/sounds/<set>/`, is served from this site's own origin, and is
listed here with its source, licence and the edits made. Raw sources go in the git-ignored `design/sources/<set>/`
(re-fetch them with the commands below). A set's files are cached by the service worker on first play (a small set, precached) and kept across
builds (`csm-sounds`), so **a changed file gets a new name** (or the set a new folder), never new bytes under an old one.

Licences: CC0 preferred; a CC-BY set is credited on the About page.

## stick: the click's Stick sound (#536)

- **Source:** VSCO 2 CE, `Percussion/` (<https://github.com/sgossner/VSCO-2-CE>). Licence: CC0 1.0, credited on the
  About page with the rest of VSCO 2 CE. The set has no drum kit (no hi-hat or cross-stick), so the stick is its claves
  and the hat its tambourine shake.
- **Files:** `accent.wav` ← `Claves1_Hit_v3_rr1_Sum.wav` (loudest dynamic), `beat.wav` ← `Claves1_Hit_v1_rr1_Sum.wav`
  (softest), `hat.wav` ← `Tamb1-Shake_v1_rr1_Sum.wav`.
- **Edits:** `afconvert -f WAVE -d LEI16@32000 -c 1` (mono 16-bit 32 kHz: the clicks' brightness is above 12 kHz),
  trimmed to the onset (the first sample over 1% of the peak), cut to 0.25 s (accent), 0.2 s (beat) and 0.12 s (hat)
  with a linear fade over the last 0.08, 0.07 and 0.06 s, and peak-normalized to 0.9.
- **Size:** 3 files, 37 KB. Precached by the service worker (`web/build/sw.ts`), unlike the larger sets.
- **Fetch:** `https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Percussion/<file>`.

## piano: Hear line and Play's lead (#538)

- **Source:** VSCO 2 Community Edition, `Keys/Upright Piano/`, by Simon Dalzell of Ivy Audio for Versilian Studios
  (<https://github.com/sgossner/VSCO-2-CE>). Licence: CC0 1.0 (the repo's `LICENSE`); the set's `Info.txt` encourages
  credit to both, given on the About page.
- **Files:** `Player_dyn2_rr1_006.wav` … `_034.wav`, every other file (the set's `MappingChart.txt`: file *n* is MIDI
  21 + *n*), so a sample every major third from A1 (33) to F6 (89); saved as `<midi>.wav`. The second of three dynamics,
  soft enough to sit under a player.
- **Edits:** `afconvert -f WAVE -d LEI16@24000 -c 1` (stereo 44.1 kHz → mono 16-bit 24 kHz), then trimmed to the onset
  (the first sample over 1% of the peak), cut to 2.5 s with a linear fade over the last 0.5 s, and peak-normalized to
  0.9. Pitch checked by autocorrelation (A2 = 110 Hz, A4 = 444 Hz).
- **Size:** 15 files, 1.8 MB.
- **Fetch:** `https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/Keys/Upright%20Piano/Player_dyn2_rr1_<nnn>.wav`.

## comp: Hear changes' piano (#539, #508)

- **Source:** the same VSCO 2 CE Upright Piano as `piano/`, its softest dynamic, `Player_dyn1_rr1_012.wav` … `_030.wav`
  (every other file: MIDI 45, A2, to 81, A5, every major third); saved as `<midi>.wav`.
- **Edits:** as `piano/`, cut to 4 s with a 0.8 s fade (a voicing is held to the next chord, and struck again each bar).
- **Size:** 10 files, 1.8 MB.

## bass: Hear changes' bass (#539, #508)

- **Source:** VSCO 2 CE, `Strings/Solo Contrabass/Pizz/`, the first dynamic's first round-robin (`BKCtbss_Pizz_<note>_v1_rr1.wav`).
  Licence: CC0 1.0. The set names its notes an octave low (`E0` is E1, MIDI 28; checked by a harmonic-product pitch
  estimate: C1 → 65.4 Hz, A1 → 110 Hz). Taken: E0 F♯0 G0 A♯0 C1 D1 E1 F♯1 G♯1 A1 C♯2 E2, saved as `<midi>.wav` (28 … 52);
  `G#2` and `B2` left out (above the bass's range, and `B2` didn't read as its name).
- **Edits:** as `piano/` (mono 16-bit 24 kHz, onset trim, peak 0.9), cut to 2 s with a 0.4 s fade.
- **Size:** 12 files, 1.0 MB.

## drums: the pattern sets' kit (#540, #509)

- **Source:** VCSL (<https://github.com/sgossner/VCSL>), CC0 1.0: `Idiophones/Struck Idiophones/Suspended Cymbal 1/`
  (the ride: `susCymb1_hit_stick_mp1`, `_pp1` as `ride-soft`, `susCymb1_hit_bell_mf1` as `bell`), `Hi-Hat Cymbal/`
  (`HiHat_Close_rr1` the foot's chick as `hat`, `HiHat_HitC_v2_rr1` as `hat-tip`, `HiHat_HitO_rr1` as `hat-open`),
  `Membranophones/Struck Membranophones/Snare Drum, Modern 2/Snare3M_Xstick_v2_rr1` (cross-stick, `stick`) and
  `Bass Drum 1/BDrumNew_hit_v2_rr1` (`kick`, a soft concert bass drum hit standing in for a jazz kick).
- **Not recorded:** VCSL has no brushes, so the sweep and the tap are synthesized (band-passed noise, `clickSounds.ts`).
- **Edits:** mono 16-bit 24 kHz, onset trim, peak 0.9 (as `piano/`); ride 2 s, bell 1.5 s, open hat 0.8 s, kick 0.6 s,
  the rest 0.3 s, each with a short fade. Levels per voice are `DRUM_KIT`'s gains.
- **Size:** 8 files, 384 KB.
