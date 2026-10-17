# Notable Recordings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A library song page names one notable recording (artist, album, label, year) and may play it through `<VideoEmbed>`, with an always-present new-tab YouTube link.

**Architecture:** Two new chart header keys (`recording:`, `youtube:`) parsed and validated in the engine (`chart.ts`), surfaced by `tuneSummary`. The web app renders them in a prerendered `<SongRecording>` section and in the `MusicComposition` JSON-LD as `recordedAs`, both behind the `recordings` feature flag.

**Tech Stack:** TypeScript (engine, no DOM), Nuxt 4 / Vue 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-notable-recordings.md`

## Global Constraints

- `recording:` = `Artist; Album; Label; Year`, `;` separated; artist and album required; label and year may be empty.
- Year: four digits. `youtube:`: `^[A-Za-z0-9_-]{11}$`, valid only with `recording:`.
- The section sits outside `<ClientOnly>` (prerendered), heading "Recording", `print:hidden`, omitted with no recording.
- Text: `Artist, Album (Label, Year).`, album in italics, empty fields drop with their punctuation.
- Link: `https://www.youtube.com/watch?v=<id>` via `<UiTextLink external>`; nothing loads from YouTube before play; no CSP change.
- `recordedAs`: `MusicRecording` with `byArtist` `MusicGroup`, `inAlbum` `MusicAlbum`, `datePublished` (year, when set), `url` only with `youtube:`. No label.
- Feature flag `recordings`: off by default, on in e2e and a11y builds.
- `no recording:` is advice (`tuneAdvice`), never a gap; forms and exercises don't get it.
- YouTube IDs only from official uploads, checked embeddable (oEmbed 200) before being written.

## Review Focus

1. `recording:` written with commas instead of semicolons (`John Coltrane, Blue Train`): one field → the "artist and album" diagnostic, never a page with an empty album. Pinned in Task 1.
2. Extra `;` fields (`A; B; C; 1957; x`): reported, not silently dropped. Pinned in Task 1.
3. `recording:` inside a section: the existing "belongs in the header" diagnostic. Pinned in Task 1.
4. A recording with only artist and album: `John Coltrane, Blue Train.` with no empty parentheses. Pinned in Task 2.
5. Flag off: no section and no `recordedAs` in the prerendered page. Pinned in Task 2 (`songHead` takes the flag).

---

### Task 1: engine — the keys, `chartRecording`, the summary and the hint

**Files:**
- Modify: `engine/src/chart.ts` (`MetaKey`, `META_KEYS`, validation in `parseChart`, `Recording`, `chartRecording`), `engine/src/tune.ts` (`TuneSummary.recording`, `.youtube`, `tuneAdvice`), `engine/src/index.ts`, `README.md` (header table)
- Test: `engine/src/__tests__/chart.test.ts`, `engine/src/__tests__/tune.test.ts`, `engine/src/__tests__/api.test.ts` (snapshot)

**Interfaces:**
- Produces: `type Recording = Readonly<{ artist: string; album: string; label: string; year: string }>`; `chartRecording(doc: ChartDoc): Recording | null`; `TuneSummary.recording: Recording | null`, `TuneSummary.youtube: string`.

- [ ] **Step 1: failing tests** (`chart.test.ts`):

```ts
describe('chartRecording', () => {
  const rec = (text: string) => chartRecording(parseChart(text).value)
  const diags = (text: string) => parseChart(`${text}\n\nsection: A\nbars: 4\n1 | C`).diagnostics.map((d) => d.message)

  it('reads artist; album; label; year, keeping commas in the album', () => {
    expect(rec('recording: John Coltrane; Blue Train; Blue Note; 1957')).toEqual({ artist: 'John Coltrane', album: 'Blue Train', label: 'Blue Note', year: '1957' })
    expect(rec('recording: Bill Evans Trio; Sunday at the Village Vanguard, Live')).toEqual({ artist: 'Bill Evans Trio', album: 'Sunday at the Village Vanguard, Live', label: '', year: '' })
    expect(rec('recording: Miles Davis; Kind of Blue; ; 1959')).toMatchObject({ label: '', year: '1959' })
    expect(rec('title: X')).toBeNull()
  })

  it('reports a recording without artist and album, a bad year, extra fields', () => {
    const need = 'recording: artist; album; label; year (artist and album required)'
    expect(diags('recording: John Coltrane, Blue Train')).toContain(need)
    expect(diags('recording: ; Blue Train')).toContain(need)
    expect(diags('recording: A; B; C; 57')).toContain('recording: the year is four digits')
    expect(diags('recording: A; B; C; 1957; D')).toContain(need)
    expect(diags('recording: A; B; Blue Note; 1957')).toEqual([])
    expect(rec('recording: John Coltrane, Blue Train')).toBeNull()
  })

  it('checks youtube: is an 11-character ID, given with a recording', () => {
    expect(diags('recording: A; B\nyoutube: XpZHUVjQydI')).toEqual([])
    expect(diags('recording: A; B\nyoutube: https://youtu.be/XpZHUVjQydI')).toContain('youtube: the 11-character video ID')
    expect(diags('youtube: XpZHUVjQydI')).toContain('youtube: needs a recording: line')
  })

  it('keeps recording: in the header', () => {
    expect(parseChart('section: A\nrecording: A; B\n1 | C').diagnostics.map((d) => d.message)).toContain('recording: belongs in the header, before the first section:')
  })
})
```

`tune.test.ts`: `tuneSummary(…)` of `recording: John Coltrane; Blue Train; Blue Note; 1957\nyoutube: XpZHUVjQydI` gives those fields; a chart without gives `recording: null, youtube: ''`. `tuneAdvice` adds `'no recording: name one notable recording of the tune'` for a tune, not for `kind: form`.

- [ ] **Step 2:** `cd engine && npx vitest run src/__tests__/chart.test.ts src/__tests__/tune.test.ts` → FAIL.
- [ ] **Step 3: implement.** Add `'recording' | 'youtube'` to `MetaKey`/`META_KEYS`. In `chart.ts`:

```ts
export type Recording = Readonly<{ artist: string; album: string; label: string; year: string }>
const fields = (value: string) => value.split(';').map((s) => s.trim())
/** recording:'s problem, or null */
function recordingProblem(value: string): string | null {
  const [artist = '', album = '', , year = '', ...rest] = fields(value)
  if (!artist || !album || rest.length) return 'recording: artist; album; label; year (artist and album required)'
  return year && !/^\d{4}$/.test(year) ? 'recording: the year is four digits' : null
}
/** the tune's notable recording (recording:), null without a readable one */
export function chartRecording(doc: ChartDoc): Recording | null {
  const value = metaValue(doc, 'recording')
  if (!value || recordingProblem(value)) return null
  const [artist = '', album = '', label = '', year = ''] = fields(value)
  return { artist, album, label, year }
}
```

In `parseLine`, after the `kind` check: `if (key === 'recording' && value) { const p = recordingProblem(value); if (p) return p }` and `if (key === 'youtube' && value && !/^[A-Za-z0-9_-]{11}$/.test(value)) return 'youtube: the 11-character video ID'`. In `parseChart`, after the lines map: a `youtube` meta line with no non-empty `recording` meta → diagnostic `youtube: needs a recording: line` at its line. `tuneSummary` adds `recording: chartRecording(doc), youtube: metaValue(doc, 'youtube')`; `tuneAdvice` adds `!metaValue(doc, 'recording') && chartKind(doc) === 'tune' && 'no recording: name one notable recording of the tune'`. Export `chartRecording` and `type Recording` from `index.ts`. README: two rows after `aka:`.
- [ ] **Step 4:** tests PASS; `npx vitest run -u src/__tests__/api.test.ts` and check the snapshot only adds `chartRecording`; `make golden` → no diff.
- [ ] **Step 5:** commit "Charts: recording: and youtube: (notable recordings)".

### Task 2: web — the section, the JSON-LD, the flag, the privacy page

**Files:**
- Create: `web/app/components/SongRecording.vue`, `web/app/utils/recording.ts`; Test: `web/test/SongRecording.test.ts`, `web/test/recording.test.ts`
- Modify: `web/app/composables/useFeature.ts` (`'recordings'`), `web/nuxt.config.ts` (`recordings: false`), `web/package.json` (e2e and a11y scripts: `NUXT_PUBLIC_FEATURES_RECORDINGS=true`), `web/app/utils/structuredData.ts` (`recordedAs`), `web/app/utils/songHead.ts` (`recording`, `youtube`, flag), `web/app/pages/song/[[slug]].vue`, `web/app/pages/privacy.vue`; Tests `web/test/structuredData.test.ts`, `web/test/songHead.test.ts`, e2e `web/e2e/seo.spec.ts`

**Interfaces:**
- Consumes: `Recording`, `TuneSummary.recording`, `.youtube` (Task 1).
- Produces: `recordingParts(r: Recording): { artist: string; album: string; tail: string }` (tail = ` (Blue Note, 1957).` or `.`); `youtubeUrl(id: string): string`; `recordingLd(t: TuneSummary)`; `songHead(slug, { recordings: boolean })` returning `recording: Recording | null`, `youtube: string`.

- [ ] **Step 1: failing tests.**
  - `recording.test.ts`: `recordingParts({ artist: 'John Coltrane', album: 'Blue Train', label: 'Blue Note', year: '1957' })` → `{ artist: 'John Coltrane', album: 'Blue Train', tail: ' (Blue Note, 1957).' }`; label only → `' (Blue Note).'`; year only → `' (1957).'`; neither → `'.'`. `youtubeUrl('XpZHUVjQydI')` → `'https://www.youtube.com/watch?v=XpZHUVjQydI'`.
  - `structuredData.test.ts`: `tuneLd({ ...TUNE, recording: R, youtube: '' }, PATH).recordedAs` equals `{ '@type': 'MusicRecording', byArtist: { '@type': 'MusicGroup', name: 'John Coltrane' }, inAlbum: { '@type': 'MusicAlbum', name: 'Blue Train' }, datePublished: '1957' }`; with `youtube` adds `url`; with no year no `datePublished`; `TUNE` (no recording) has no `recordedAs`; `tuneLd(t, path, { recordings: false })` has none.
  - `songHead.test.ts`: `songHead('blue-trane', { recordings: true })?.recording` is the chart's; with `{ recordings: false }` it's null and `ld` has no `recordedAs`.
  - `SongRecording.test.ts`: mounted with R and no youtube → heading "Recording", text "John Coltrane, Blue Train (Blue Note, 1957).", `<em>Blue Train</em>`, no button, no link; with `youtube` → a button "Play the video (loads YouTube)" and an `a[href="https://www.youtube.com/watch?v=…"][target=_blank][rel="noopener noreferrer"]` reading "Watch on YouTube"; and no `iframe` until the button is clicked.
- [ ] **Step 2:** `cd web && npx vitest run test/recording.test.ts test/structuredData.test.ts test/songHead.test.ts test/SongRecording.test.ts` → FAIL.
- [ ] **Step 3: implement.**
  - `recording.ts`: `recordingParts` and `youtubeUrl` as above.
  - `structuredData.ts`: `tuneLd(t, path, opts = { recordings: true })` spreads `...(opts.recordings && t.recording ? { recordedAs: recordingLd(t.recording, t.youtube) } : {})`.
  - `songHead(slug, opts = { recordings: false })`: passes `opts` to `tuneLd`, returns `recording: opts.recordings ? summary.recording : null`, `youtube: opts.recordings && summary.recording ? summary.youtube : ''`.
  - Page: `songHead(slug(), { recordings: useFeature('recordings') })`; after the lead-sheet section: `<SongRecording v-if="song?.recording" :recording="song.recording" :youtube="song.youtube" :title="song.title" />`.
  - `SongRecording.vue`: `<section aria-labelledby="recording-heading" class="mt-10 max-w-2xl print:hidden">`, `<UiSubheading id="recording-heading" :level="2">Recording</UiSubheading>`, `<UiText class="mt-2">{{ artist }}, <em>{{ album }}</em>{{ tail }}</UiText>`, then with `youtube`: `<VideoEmbed class="mt-4" :id="youtube" :title="`${title}, ${artist}`">{{ artist }}, on YouTube.</VideoEmbed>` and `<UiText class="mt-2"><UiTextLink :href="youtubeUrl(youtube)" external>Watch on YouTube</UiTextLink></UiText>`.
  - Flag: `'recordings'` in `Feature`; `recordings: false, // a song's notable recording (docs/superpowers/specs/2026-10-17-notable-recordings.md)` in `nuxt.config.ts`; `NUXT_PUBLIC_FEATURES_RECORDINGS=true` in the `e2e` and `a11y` scripts.
  - Privacy: the section heading and its "On this page" entry → "Videos"; text: "The About page and some song pages show a YouTube video. Nothing loads from YouTube until you press play. …".
- [ ] **Step 4: e2e** (`seo.spec.ts`, JS off): `/song/blue-trane` has a "Recording" heading, the text "John Coltrane, Blue Train (Blue Note, 1957).", and its JSON-LD has `recordedAs.inAlbum.name === 'Blue Train'`; with JS on, no request to a `youtube` host during load. (The play-button e2e and a11y scan of a video page come with the first curated `youtube:` in the curation PR; the component test covers them until then.)
- [ ] **Step 5:** `make test`, `make lint`, `make e2e`, `make a11y`; commit "Song pages: the notable recording, behind the recordings flag".

### Task 3: the first recording, and the link checker

**Files:**
- Modify: `engine/charts/blue-trane.txt` (`recording: John Coltrane; Blue Train; Blue Note; 1957`)
- Create: `engine/scripts/check-recordings.ts`, `engine/package.json` (`"check-recordings": "vite-node scripts/check-recordings.ts"`)

- [ ] **Step 1:** add the recording line to Blue Trane (it's the e2e fixture; no `youtube:` until an official, embeddable upload is confirmed); `npm run analyse -- charts/blue-trane.txt --save`; `make golden` (expect no diff); `make og` (expect no redraw: the card shows no recording).
- [ ] **Step 2:** `check-recordings.ts`: for each library chart with `youtube:`, GET `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`; print `✓ <slug> <author_name>` on 200, `✗ <slug> <status>` otherwise (401 = embedding disabled, 404 = gone); exit 1 on any ✗. Run by hand, not in CI.
- [ ] **Step 3:** `docs/design.md` §7b: the keys, the section, `recordedAs`, the flag and the checker; commit "A notable recording for Blue Trane, and a link checker".

## Not in this plan

- Curation of the first ~20 tunes and turning the flag on (spec §10 step 3), then the rest (step 4): each a later PR, facts from Discogs/MusicBrainz, IDs from official uploads checked with `check-recordings`.
- Open questions 1–4 (composer pages, non-embeddable videos, the description clause, a second service): undecided; not built.
