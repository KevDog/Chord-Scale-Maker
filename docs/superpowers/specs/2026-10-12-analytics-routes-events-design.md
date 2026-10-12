# Analytics: routes and events: design

Date: 2026-10-12. Status: approved (questions decided by the user the same day). Issue: #149.

## Goal

Know which pages and songs are used, and (once on Pro) a few actions: shares made and opened, sheet, instrument,
print, transpose. Keep every privacy rule: cookieless, no third-party origins, CSP unchanged (`script-src` /
`connect-src 'self'`), no inline script, production builds only, nothing from a user's own chart text.

## Facts this rests on (Vercel docs, 2026-10)

- Hobby: 50,000 events / month included (page views count), then collection pauses; no custom events.
- Pro: no included events, $0.03 per 1K, paid from the $20 monthly usage credit; custom events with **at most 2
  properties** each (8 with Web Analytics Plus, $10/month); values are strings, numbers, booleans or null, ≤ 255
  characters, no nesting.
- `@vercel/analytics` 2.0.1 still needs `vue-router` ^4 (we're on 5): keep the plain same-origin script.
- The documented `window.va` queue stub is an inline script; ours goes in the existing same-origin
  `public/analytics-before-send.js`.

## Part 1: page views with routes (ships on)

- The analytics script tag gets `data-disable-auto-track` (checked against the production `script.js` on
  2026-10-12: it reads `dataset.disableAutoTrack`; with it set the script sends no page view itself and stops
  patching `pushState`, which is how it counts in-app navigations today).
- `analytics-before-send.js` also defines `window.va` as the queue stub (`(window.vaq = window.vaq || []).push(arguments)`).
- A client plugin `web/app/plugins/analytics.client.ts` sends `va('pageview', { route, path })` on Nuxt's
  `page:finish` (the first page and every navigation, once each), only when `window.va` exists (production builds).
- `route` is the matched route's pattern in Vercel's form: `/song/:slug?` → `/song/[slug]`, `/tunes/:slug` →
  `/tunes/[slug]`, static pages as their path; `path` is `location.pathname` (no query, no `#…`).
- So the dashboard's Pages still lists each song (`/song/autumn-leaves`: the most-loaded songs), and Routes groups them.

## Part 2: custom events (behind `analyticsEvents`, off until on Pro)

| Event | Data (≤ 2) | Sent when |
|---|---|---|
| `Share created` | `song` | a share link is made |
| `Shared link opened` | `song` | a page loads a `#s=` link |
| `Sheet chosen` | `sheet` (`changes`, `scales`, `arpeggios`) | Work on changes (not the initial sheet) |
| `Instrument chosen` | `instrument` (an `InstrumentName`) | the instrument changes; at most once per song page visit |
| `Printed` | `sheet`, `song` | Print |
| `Transposed` | `song`, `to` (the target key as written) | a transpose is applied |

- `song` is a library slug when the chart is a library chart as published (or a shared text equal to one), else
  `own`. Never a title, never chart text.
- One typed util `web/app/utils/analytics.ts`: `track(event)` takes a discriminated union of the six events (so names
  and value types are checked), sends `va('event', { name, data })` only when the flag is on and `window.va` exists.
- The privacy page adds, with the flag on: "and a few anonymous actions (which sheet, instrument, printing,
  transposing, sharing), never your chart's contents."

## Cost (for the record)

About 4–5 events a visit (2 page views + ~2.5 actions): ~$0.15 per 1,000 visits on Pro, inside the $20 credit up to
~660K events a month.

## Testing

- Unit: the route-pattern mapping (each page in `web/app/pages/`); `track` sends nothing with the flag off or without
  `window.va`; each event builds ≤ 2 properties, all ≤ 255 characters; `songOf(target, text)` gives the slug only
  for a library chart as published (and a shared text equal to one), else `own`.
- e2e (`web/e2e/analytics.spec.ts`): `page.addInitScript` defines a recording `window.va`; one `pageview` with
  route and path per navigation (home → library tune → song); with events on (e2e builds turn flags on): instrument
  changed twice → one `Instrument chosen`; print, share, sheet → one event each; a `#s=` link → `Shared link opened`
  with `own`; no event data contains the chart's title.
