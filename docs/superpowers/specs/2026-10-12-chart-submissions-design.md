# Send a chart to the library: design

Date: 2026-10-12. Status: approved (questions decided by the user the same day). Issue: #153.

## Goal

Let a user send the site owner a chart for the library, or suggest changes to a library chart, from the editor. It
arrives as an email with the chart attached as a `.txt` the owner can drop into `engine/charts/`. The owner reviews
and adds it by hand (the usual "make a chart" workflow: analyse, golden); the site never publishes anything itself.

## What changes in the product

- **Entry points**, in the editor beside **Report a chart error** (`EditorView.vue`), by what the chart is:
  - a new chart, a My charts chart, or an unsaved shared chart: **Send to the library** (added; Report a chart error
    stays);
  - a library chart you've edited (`saveTarget.kind === 'library'` and the text differs from `libraryText`):
    **Suggest these changes**, in place of Report a chart error (it already sent the edited text);
  - a library chart as published: Report a chart error only, as today.
- **The contact page** with a chart handed over (sessionStorage, as chart reports):
  - the message pre-filled: "A chart for the library: <title>" or "Suggested changes to <title>", then a blank line
    for the sender's note;
  - a card above the file drop: the chart's title and line count, "attached as <file>.txt", and a **Remove** button
    (back to a plain message);
  - a checkbox **Credit me as <name> on the tune page** (unticked; the name follows the Name field, "you" while it's
    empty);
  - above Send: "By sending, you agree I may add this chart to the library, edit it, and publish it on the site."
  - the form's own attachment stays free (a photo or PDF of the lead sheet the chart came from).
- **The tune page** (`pages/tunes/[slug].vue`) shows "Chart contributed by <name>" when the chart has a
  `contributor:` header.
- **Privacy page:** one line: a chart sent with the form is emailed with the message.
- Behind a new flag `chartSubmissions` (off; e2e builds with it on). With it off, nothing changes.

## The request

- `/api/contact`'s body gains an optional `chart`: `{ text: string; title: string; slug?: string; credit: boolean }`.
- `checkContact` validates it (`chart` errors go under a new `chart` field key):
  - `text`: non-empty after trimming, at most `LIMITS.maxChars` (20,000) characters;
  - `title`: trimmed, one line (control characters and newlines removed), at most 120 characters, "Untitled" when empty;
  - `slug` (suggestions only): `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, at most 80 characters; anything else is an error;
  - `credit`: a boolean, else false.
- `CONTACT_LIMITS.maxBytes` grows by the chart's worst case (20,000 characters × 4 bytes for UTF-8 + JSON escaping
  headroom: 90,000 bytes).
- The rest (origin check, honeypot, timing, dry run, Resend, the firewall rule on `/api/contact`) is unchanged.

## The email

- **Subject:** `Chord Scale Maker: chart for the library: <title>` or `Chord Scale Maker: suggested changes to <slug>`
  (the subject is built as today: one line, the parts sanitised).
- **Attachment:** the chart text, base64, as `<slug>.txt` for a suggestion, else `<slug from title>.txt` (lowercase,
  apostrophes dropped, other non-alphanumerics to `-`, collapsed and trimmed, at most 60 characters, `chart` when
  empty: `'Round Midnight` → `round-midnight.txt`). Alongside the form's own attachment if there is one.
- **Body:** the message; `Credit: <name>` when ticked, else `Credit: none`; `Attached: <file>` lines; the build
  version, as today.

## Credit in the chart format

- `contributor:` joins `META_KEYS` (`engine/src/chart.ts`) and the format notes (README, `docs/design.md`).
- `tuneSummary` gains `contributor: string` (`''` when absent). The owner writes the header when adding the chart.

## App structure

- `web/app/utils/chartSubmission.ts` (pure): `CHART_SUBMISSION_KEY`, the type
  `ChartSubmission = { text; title; slug?; mode: 'new' | 'suggest' }`, `submissionAction(target, text, flag)` →
  `{ send: boolean; suggest: boolean; report: boolean }` (which buttons show), and `submissionMessage(s)` (the
  pre-filled first line).
- `web/server/utils/contactMessage.ts`: `checkChart`, `chartFilename`, and `contactEmail` taking the chart.
- `contact.vue`: reads the handoff once, shows the card, checkbox and permission line, posts `chart`.
- `EditorView.vue`: the two buttons, via `submissionAction`.

## Testing

- `web/server/utils/contactMessage.test.ts`: `checkContact` with a valid chart, an empty or oversized text, a bad slug,
  a multi-line title, a non-boolean credit; `chartFilename` (the examples above, an all-symbol title, a long title);
  `contactEmail` (both subjects, the credit line, two attachments).
- `web/test/chartSubmission.test.ts`: `submissionAction` for library-published, library-edited, mine, new, no target,
  flag off; `submissionMessage`.
- `engine`: `contributor:` parses and round-trips; `tuneSummary` reads it (library charts have none, so `make golden`
  needn't change; run it to confirm).
- e2e (`web/e2e/chart-submission.spec.ts`, dry run): from a new chart, Send to the library → the contact page shows the
  card and the pre-filled message; tick credit, send → "Thanks"; capture the request body (`page.waitForRequest`) and
  check `chart.text` is the chart and `credit` is true. From an edited library chart, Suggest these changes → its slug
  in the request; Report a chart error isn't shown. The tune page's credit line is one template line over
  `tuneSummary.contributor` (tested in the engine); no library chart has the header yet, so no e2e covers it.
