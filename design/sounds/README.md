# Sampled sounds: provenance

Every recorded sound the app plays lives in `web/public/sounds/<set>/`, is served from this site's own origin, and is
listed here with its source, licence and the edits made. Raw sources go in the git-ignored `design/sources/<set>/`
(re-fetch them with the commands below). A set's files are cached by the service worker on first play and kept across
builds (`csm-sounds`), so **a changed file gets a new name** (or the set a new folder), never new bytes under an old one.

Licences: CC0 preferred; a CC-BY set is credited on the About page.

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
