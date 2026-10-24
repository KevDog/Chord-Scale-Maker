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
