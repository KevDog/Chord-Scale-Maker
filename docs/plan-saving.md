# Saving charts without accounts: plan

Status: **done.** Phases 1–5 built behind the `myCharts` flag (it replaced `newChart`); on in production since
sign-off.

People can keep their work three ways, none of which needs an account or a server:

1. **My charts:** edits and new charts save themselves in this browser.
2. **Download / Open:** a chart as a `.txt` file, to keep, back up or email.
3. **Share link:** the chart (and how it was being viewed) packed into the link itself, to move between devices or
   send to someone.

Scale choices come along in all three, because they're part of the chart text (the scale column).

## Decisions

| | Decision |
|---|---|
| Editing a library chart | Auto-saved as *your version* of it, marked **Edited**, with **Revert to library version**. Also **Save as a copy**, for keeping variations side by side |
| New charts | **New chart** starts one; it saves itself into My charts from the first edit |
| Share link carries | The chart, plus the view: instrument, From root / From X and start note, interval labels, sheet, practice picks |
| Opening a share link | Opens as a *shared chart*, not saved, with **Save to My charts** |
| Where it's kept | This browser only (localStorage), said plainly in the UI and on the Privacy page |
| Flag | `myCharts`, off; covers New chart too. Turned on together after sign-off |

## The model

A saved chart is a small record, kept in localStorage under one index key plus one key per chart:

```ts
type SavedChart = Readonly<{
  id: string            // random, URL-safe (crypto.randomUUID, shortened)
  text: string          // the chart, exactly as in the editor (title and subtitle included)
  basedOn?: string      // library slug, for "your version of Autumn Leaves"
  createdAt: number
  updatedAt: number
}>
```

- **Your version of a library chart** is the one record whose `basedOn` is that slug and that isn't a copy. Opening
  `?chart=autumn_leaves` loads it if it exists, with a notice: "Your edited version · Revert to library version".
  Revert deletes the record.
- **A copy** (Save as a copy) is a separate record with its own id and no tie to the library version; its title
  gets " (copy)" if unchanged. Copies and new charts open at `?mine=<id>`.
- **Practice picks** are already remembered per library chart; saved charts get the same, keyed by id.
- **Limits:** a chart is at most `LIMITS.maxChars` (20,000 characters, as now); My charts holds at most 200 charts.
  Saving when storage is full or blocked shows a quiet notice (download it instead) and never loses the
  editor's contents.
- **Two tabs** stay in step through the `storage` event; the last write wins, per chart.
- **The old draft** (`csm-draft`, from the hidden New chart) is moved into My charts once, then removed.

## Download and Open

- **Download chart** saves `<title>.txt` (the title made filename-safe, else `chart.txt`): the chart text, UTF-8.
  It's a Blob with an object URL, so the CSP needs no change.
- **Open chart…** (a file picker, plus drag and drop onto the library or editor) takes a `.txt` up to the size
  limit. It's parsed like any typed chart, so problems show as the usual line diagnostics. It opens as a new
  chart in My charts.

## Share link

- The link is `/editor#s=<payload>`. Everything after `#` stays in the browser: it isn't sent to the server or kept
  in server logs. Vercel Web Analytics must not record it either. Check what the analytics script sends, and if the
  hash is included, strip it with a same-origin `beforeSend` script (no inline script, so the CSP is unchanged).
- **The payload** is versioned JSON, `{ v: 1, chart: text, view?: { instrument, mode, start, intervals, sheet,
  practice } }`, compressed with the browser's `CompressionStream('deflate-raw')` and base64url-encoded. A typical
  chart comes to a few hundred characters; a full 20,000-character chart to a few thousand. Over about 8,000
  characters, the Share dialog warns that some apps cut long links, and suggests Download.
- **Untrusted input:** a link is decoded with size caps (the compressed and uncompressed lengths), then each part
  is validated: the chart through the normal parser and limits, and the view fields against their known values
  (unknown ones are dropped). A bad link opens nothing and says so; it never throws.
- **Share** opens a small dialog with the link, **Copy link**, and a note that anyone with the link sees the chart.

## UI

- **Library page:** a **My charts** section above the library when there are any: title, "Edited" or "Copy" or
  "New", last changed, and Open, Download, Share and Delete (with confirmation). The search covers both lists.
  **New chart** and **Open chart…** sit by the heading.
- **Editor:** a status line by the title, "Saved in this browser · just now", or for a library chart you haven't
  touched, nothing. Beside it **Save as a copy**, **Download** and **Share**. The Revert notice shows on an edited
  library chart.
- **Help and Privacy pages:** what's kept, where, and that clearing site data removes it; the share link's privacy.

## Engine and app pieces (pure where possible, unit-tested)

- `engine/share.ts`: `encodeShare(payload) → string`, `decodeShare(string) → payload | null`, with the
  compression injected so the tests run in Node. Round-trip, size-cap, malformed and old-version tests.
- `app/utils/myCharts.ts`: the store over `utils/storage.ts`: list, get, save, delete, versionFor(slug), the draft
  migration, and the 200-chart cap. Tested with happy-dom's localStorage.
- `app/composables/useSavedChart.ts`: debounced auto-save for the editor (about 1 s after typing stops, and on
  leaving the page), with a status the UI shows.
- `filenameFor(title)` for downloads.

## Tests

- **Unit:** the share codec; the store (save, version-per-slug, copies, revert, the cap, full or unavailable
  storage, the draft migration); filenames; validation of every view field.
- **App:** the editor's status, Save as a copy, Revert; the library's My charts list and its actions.
- **E2E:**
  - edit Autumn Leaves, reload, still edited; Revert brings back the library version
  - New chart, edit, find it in My charts after a reload
  - Download, then Open the file: same chart, same scales
  - Share: open the link in a fresh browser context and see the same chart, instrument, mode and practice picks;
    Save to My charts adds it
  - a damaged link shows a message, not an error
  - no request carries the hash (analytics included)

## Phases (behind the flag; built as one PR, a commit each)

1. The share codec and the My charts store, with their unit tests. No UI.
2. Auto-save, your version of a library chart, Revert, Save as a copy, New chart into My charts, and the library's
   My charts section.
3. Download and Open (file picker and drag and drop).
4. Share link: the dialog, opening links, Save to My charts, the analytics check.
5. Help and Privacy copy, then sign-off and the flag on (replacing `newChart`).
