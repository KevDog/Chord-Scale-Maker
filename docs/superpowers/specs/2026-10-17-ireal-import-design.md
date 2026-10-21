# iReal Pro import (#261, the iReal half)

## Goal
Players bring the charts they already have in iReal Pro instead of retyping them: into My charts from the web app, and
into the permanent library (`engine/charts/`) from the command line. Chords only, concert pitch (iReal stores concert
chords; its transposition is a view setting). Anything the import can't map is reported, never silently dropped.

Out of scope: MusicXML (#261's other half, a later PR), fetching from iReal sites or forums (CSP: no third-party
origins; we read only what the user supplies), bulk import of a playlist.

## The format
- Links: `irealb://` (current) and `irealbook://` (legacy), from a forum post or the app's `.html` export (one
  `<a href="irealb://…">` per export, fully percent-encoded, `=` as `%3D`).
- `irealbook://`: 6 fields a song, `Title=Composer=Style=Key=n=Music`, music unscrambled.
- `irealb://`: 10 fields a song: title, composer, (empty), style, key, transpose, music, comp style, bpm, repeats;
  songs joined by `===`, the playlist name last when there are several. Split by counting 10 fields, not on `===`
  (an empty composer makes `===` too).
- Title: a trailing `, The` / `, A` goes back in front. Composer is "Last First": flip to "First Last" (one word:
  keep).
- Music: prefix `1r34LbKcu7`, then 50-character blocks while more than 51 remain, each with `b[i] ↔ b[49-i]` for
  i in 0–4 and 10–23 (self-inverse); the tail stays. Then `Kcl` → `| x`, `LZ` → ` |`, `XyQ` → three spaces.
- Tokens: bar lines `| [ ] { } Z`; `T44`… time; `*A` section; `N1 N2 N3 N0` endings; `x` repeat bar, `r` repeat two
  bars; `p` slash, a space an empty cell; `n` N.C.; `W` invisible root; `s`/`l` sizes; `<…>` comments (`<3x>` a
  repeat count); `S` segno, `Q` coda, `f` fermata, `U` end, `Y` spacing; chord = root, quality, `/bass`, optional
  alternate `( … )`; `,` separates chords without a cell.
- Licensing: iReal publishes the protocol for anyone to build links (no licence terms; © Technimo). The parser is our
  own: infojunkie/ireal-musicxml is GPL-3.0 (read for understanding, no code copied); pianosnake/ireal-reader is MIT.
  Charts are user transcriptions: we import what the user supplies and host nothing from the forums.

## Engine: `engine/src/ireal/` (pure TypeScript, no DOM)
- `decode.ts`: `decodeIReal(text): Parsed<IRealPlaylist>`. Input: a link, or any text holding one (the `.html`
  export, a forum post); finds the first `irealb://`/`irealbook://` link, decodes, unscrambles.
  `IRealPlaylist = { name?: string; songs: IRealSong[] }`,
  `IRealSong = { title, composer, style, key, music }` (music unscrambled). No link, or a malformed one: a diagnostic.
- `music.ts`: tokenizes a song's music into bars, each with its chords (cells, so beats are known) and its marks:
  section, time, ending, repeat open/close (with count), segno, coda, comments, final.
- `toChart.ts`: `irealToChart(song): Parsed<string>`, the chart text in the README's format, and a diagnostic for each
  thing it couldn't map (its message names the section and bar).
  - Header: `title:`, `composer:`, `style:`, `key:` (`A-` → `Am`), `time:` when not 4/4, `form:` computed from the form
    sections (`AABA, 32 bars`), `source: iReal Pro`.
  - Sections: each `*X` opens one; a repeated letter is numbered (`A1`, `A2`; the first renamed `A1` once a second
    appears); bars before any mark are `A`; `*i` → `Intro`, `*v` (or `*V`) → `Verse` with `outside: yes`.
    A coda after the form (a stretch after `]`, `}` or `Z` that opens on `Q` with no letter, no lettered section after
    it) → its own `Coda` section (`Coda1`, `Coda2` if more), outside the form by name.
  - Repeats: `{ … }` with `N1`/`N2` → `@ending` in that section (endings as sequential bars); `{ … }` without endings
    → the section, then a second section of it with `copy:`. A `}` with no `{` before it in its section repeats
    from the section's start (iReal's convention). A count other than 2 (`<3x>`) is reported.
    A `{` opening a section and closed by `}` in a later one (#394; ~8% of a forum set, A Foggy Day) is played out:
    the sections up to the `}` (the 1st ending's bars too), then again up to the 1st ending, the bars after the `}`
    ending the last unless they open a section (`*C N2`). A second-pass section that plays as written is a `copy:`;
    one cut short is written out; one left empty (all 1st ending) is dropped: A Foggy Day → A1 B A2 C.
  - Bars: `x` repeats the bar before, `r` the two before; `p` or an empty cell holds the chord; `n` → `N.C.`; a bar
    with no chord holds the one before; a section whose last chord is held past its last written bar gets `bars: N`.
    Two chords in a bar → two rows with that bar number.
  - Marks: `S` → `@segno`, `Q` → `@coda`; comments `D.S. al Coda`, `D.C. al Fine`, `D.C. al Coda`, `To Coda`, `Fine`
    → `@nav`; other comments are reported and dropped. A time change mid-section → `@time`; a metre we don't support
    (anything but 2/4 3/4 4/4 5/4 6/4) is reported and the bars keep 4/4.
  - Chords: qualities mapped to ours (`^`/`^7` → `Maj7`, `-` → `m`, `-7` → `m7`, `h`/`h7` → `m7b5`, `o` → `dim`,
    `o7` → `dim7`, `+` → `aug`, `-^7` → `mMaj7`, `^9` → `Maj9`, `-6` → `m6`, `7alt` → `7alt`, the rest by the same
    substitutions); each result checked with `cellError`; one that fails is reported and its bar holds the chord
    before. Alternate chords in `( )` are dropped and reported; `W/C` (a bass with no chord) is reported; fermata,
    `U`, sizes and spacing are ignored silently (layout only).
- `index.ts` exports `decodeIReal`, `irealToChart` and the two types; `api.test.ts`'s snapshot updated.
- Tests first (TDD): hand-written songs in `engine/src/ireal/__tests__/` (unscramble round trip, field splitting with
  an empty composer, every token, every mapping and every report), plus one short real-shaped `.html` export written
  for the test. No forum playlists in the repo.

## CLI
Superseded by `csm add` (docs/superpowers/specs/2026-10-18-csm-add-design.md, #402).

## Web (flag `ireal`, off; e2e builds with all on)
- `web/app/utils/chartFile.ts`: `readChartFile` also takes a `.html`/`.htm` file (under the flag); its text goes to
  `decodeIReal` instead of being a chart.
- `useOpenChart` (Library's Open chart… and its file drop) and a new Library button **Import iReal link…** (a dialog
  with a text field for a pasted link) share one flow:
  1. decode; an error → the existing error line;
  2. several songs → a picker (`UiListbox` of titles, the playlist name as its label) for one;
  3. `irealToChart`; diagnostics → a dialog listing them with **Open anyway** / **Cancel**;
  4. `saveChart` → `/song?mine=<id>`.
- Paste bars (`BarDialog.vue`): text holding an iReal link (under the flag) → the song (picker if several) → its bars,
  as the same bar list `parseBarLine` gives, with the import's diagnostics shown as paste diagnostics. Headers and
  sections are not inserted (Paste bars inserts bars).
- Help page: a line under Open chart… on iReal imports.
- Tests: unit tests for the flow (`web/test/`); e2e for the file, the link dialog, the playlist picker, the report and
  Paste bars; `make a11y` for the new dialogs.

## Verification
`make test`, `make lint`, `make e2e`, `make a11y`; the CLI run by hand on a real export (not committed).
