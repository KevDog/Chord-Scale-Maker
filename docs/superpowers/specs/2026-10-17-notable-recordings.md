# Notable Recordings: Spec

*Specification, 2026-10-17. Status: proposed. Follows on from `docs/superpowers/plans/2026-10-12-seo-discoverability.md`, where the sitemap is now live.*

## 1. Summary

Each library tune's song page names one notable recording: the artist, the album, the label and the year. It may also have a YouTube video of that recording. The video plays through the existing click-to-load `<VideoEmbed>`, and a plain link to it always opens in a new tab.

This replaces the earlier idea of composer photographs, for three reasons:

- **Search:** the recording adds text that is different on every tune page, and gives the `MusicComposition` JSON-LD a `recordedAs` entry.
- **Practice:** it answers the student's first question: which version should I learn this from?
- **Licensing:** it raises no image-licensing questions.

## 2. Goals and non-goals

**Goals**

- One recording per tune, curated and accurate.
- Indexable text for that recording in the prerendered HTML of every song page.
- An optional video that loads nothing from YouTube until the visitor presses play, as on the About page.
- No change to the CSP, and no third-party requests before the visitor acts.

**Non-goals**

- More than one recording per tune, discographies, or personnel lists.
- Streaming-service links (Spotify, Apple Music). They can be added later as further optional fields.
- Players on the library or composer pages.
- Recordings for `kind: form` and `kind: exercise` charts (F Blues, Rhythm Changes).

## 3. Chart format

There are two new optional header keys. Both are added to `META_KEYS` in `engine/src/chart.ts` and documented in the README's chart-header table.

| Key | Value | Example |
|---|---|---|
| `recording:` | Artist; album; label; year. Fields are separated by `;` (as in `aka:`), because an album title may contain a comma. The label and year may be left empty, but the artist and album are required. | `recording: John Coltrane; Blue Train; Blue Note; 1957` |
| `youtube:` | An 11-character YouTube video ID of that same recording. It is valid only together with `recording:`. | `youtube: XpZHUVjQydI` |

The ID in the table is an example of the format only and has not been checked.

**Parsing and validation.** Add a `chartRecording(doc)` function next to `chartAka`. It returns `{ artist, album, label, year } | null`. Validation messages are reported where the parser already reports header problems:

- `recording:` with fewer than two non-empty fields.
- A year that is not four digits.
- `youtube:` that does not match `^[A-Za-z0-9_-]{11}$`.
- `youtube:` without `recording:`.

**Tune summary.** `TuneSummary` (`engine/src/tune.ts`) gains `recording: Recording | null` and `youtube: string`. The engine's public API snapshot (`api.test.ts`) changes if `Recording` or `chartRecording` is exported.

**Curation hint.** Add `no recording: name one notable recording of the tune` to the analyser's hints next to the existing `no source:` and `no aka:` hints. It must not fail `make test`; it is a hint, not a gap.

**Golden fixture.** `golden.json` does not include header metadata, so `make golden` should show no diff. Run it anyway to confirm.

## 4. Song page

On the song page (`web/app/pages/song/[[slug]].vue`), add a section after "Chord changes (lead-sheet style)". Like that section, it sits outside `<ClientOnly>`, so it is present in the prerendered HTML and remains visible once the editor loads.

```
Recording
John Coltrane, Blue Train (Blue Note, 1957).       ← text, always shown
[ VideoEmbed: click to play ]                      ← only when youtube: is set
Watch on YouTube ↗                                 ← <UiTextLink external>, only when youtube: is set
```

- **Heading:** "Recording" (`UiSubheading`, level 2), with `aria-labelledby` as in the existing section, and `print:hidden`.
- **Text:** `Artist, Album (Label, Year).` The album is set in italics. Empty fields drop out with their punctuation.
- **Video:** `<VideoEmbed :id="song.youtube" :title="`${song.title}, ${artist}`">`, unchanged. The caption names the recording and the source, for example "John Coltrane, on YouTube."
- **Plain link:** always rendered with the video, to `https://www.youtube.com/watch?v=<id>`, using `<UiTextLink external>`, which already sets `target="_blank"` and `rel="noopener noreferrer"`. This is the fallback when a label blocks embedded playback, which cannot be detected from a cross-origin frame.
- **No recording:** the section is omitted.

## 5. Structured data

In `web/app/utils/structuredData.ts`, the `MusicComposition` gains `recordedAs` when the tune has a recording:

```json
"recordedAs": {
  "@type": "MusicRecording",
  "byArtist": { "@type": "MusicGroup", "name": "John Coltrane" },
  "inAlbum": { "@type": "MusicAlbum", "name": "Blue Train" },
  "datePublished": "1957",
  "url": "https://www.youtube.com/watch?v=<id>"
}
```

- `MusicGroup` is used for every artist, solo or band. Schema.org permits it for a single performer, and it avoids having to classify each artist.
- `url` is included only when `youtube:` is set.
- The label is shown as text only. Modelling it requires `MusicRelease.recordLabel`, which adds nesting for little benefit.

## 6. Page description

`tuneDescription` gains `, as recorded by <Artist> (<year>)` after the key, only with the recordings flag (#364). Given the lowest priority, it fitted none of the 105 recorded tunes, so it drops after the guide tones and before the other titles (which now outlast the guide tones too) and "Chords only, no melody": 67 of 105 show it, and tunes losing their other titles fall from 22 to 6 (2026-10-17).

## 7. Curation rules

1. **One recording per tune**, chosen in this order:
   1. the recording whose changes the chart follows, where the chart follows a specific version;
   2. otherwise, the composer's own first recording, for jazz compositions;
   3. otherwise, the recording jazz players treat as the reference, for standards from musicals and the songbook (Kern, Arlen, Porter and so on).
2. **Facts from a primary or authoritative source:** the album's own credits, the label's catalogue, or Discogs or MusicBrainz. The year is the release year, not the session date. Where these differ, use the release year and note the session date in a `#` comment.
3. **YouTube only from official uploads:** the label's channel, the artist's official channel, or YouTube's auto-generated "Provided to YouTube by …" Topic uploads. Unofficial uploads are not used, because they are taken down and the site should not send visitors to them.
4. **Confirm embedded playback during curation.** Many label uploads disable playback on other sites. Before writing `youtube:`, confirm that the video plays when embedded. If it does not, write `(link only)` after the ID (`youtube: AbCdEfGhIjK (link only)`): the song page then shows only a plain "Listen on YouTube ↗" link, opening in a new tab, with no player (§11.2, #363). `check-recordings` expects oEmbed's 401 for such a video and reports one that now embeds.
5. **Kept in the chart file**, reviewed in the commit diff like any other header change.

**Tooling.** An optional script, `engine/scripts/check-recordings.ts`, run by hand rather than in CI because it needs the network, would:

- list the charts that have `youtube:`;
- query YouTube's oEmbed endpoint for each;
- report any video that is unavailable or does not permit embedding.

Re-run it before milestones to catch link rot.

## 8. Privacy and CSP

- **No CSP change:** `frame-src https://www.youtube-nocookie.com` already permits the player (`web/build/csp.ts`).
- **Nothing loads from YouTube until play is pressed:** `<VideoEmbed>` fetches no thumbnail and no script beforehand. Its button says "Play the video (loads YouTube)".
- **Privacy page:** rename "The video on the About page" to "Videos", and say that the About page and some song pages show a YouTube video that loads only when played.

## 9. Tests

- **Engine unit tests:**
  - `chartRecording` parsing, with empty fields, a comma in the album, and an invalid year;
  - `youtube:` validation;
  - `youtube:` without `recording:`;
  - `tuneSummary` fields.
- **Web unit tests:** `structuredData.test.ts` covers `recordedAs` with and without `url`, and `songHead.test.ts` covers the description clause if it is adopted.
- **e2e (`seo.spec.ts`), on the prerendered HTML without JavaScript:**
  - A tune with a recording contains the recording text and `recordedAs`.
  - A tune with `youtube:` has the play button and an external link with `target="_blank"` and `rel="noopener noreferrer"`.
  - The page makes no request to any YouTube origin before play is pressed.
- **a11y (`make a11y`):** axe scan of a song page with a video. The external link's new-tab behaviour is announced as on other external links.

## 10. Rollout

1. Engine: keys, parser, validation, `TuneSummary`, hint and tests.
2. Web: song page section, JSON-LD, privacy page and tests, behind a feature flag (`recordings`, off by default; on in e2e).
3. Curation: a first batch of about 20 well-known tunes, reviewed for accuracy. Turn the flag on.
4. Curation of the rest of the library's 361 tunes, in batches by composer. The section is simply absent on tunes not yet done.

## 11. Decisions (formerly open questions; decided 2026-10-17)

1. **Composer pages:** no. Rows stay short on phones; the song page names the recording.
2. **Non-embeddable videos:** keep the `youtube:` ID and show a plain "Listen on YouTube ↗" link, opening in a new tab, with no player (#363).
3. **Description clause (§6):** adopt (#364).
4. **A second service:** no. YouTube only.
