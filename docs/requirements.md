# jazz-scales web app: requirements

## Goal

Public web app that turns a concert-pitch chord chart into printable chord-scale
sheets (one staff per chord), optionally transposed per instrument. Web
counterpart of `jazz_scales.py`.

## Decisions

- Stack: Nuxt 4, TypeScript strict, Tailwind CSS, VexFlow, deployed on Vercel.
- Rendering: in browser (VexFlow). No server-side LilyPond (unsupported on Vercel; revisit if that changes).
- Domain: `chordscalemaker.com` (custom domain, attached once deployed; build first on the default `*.vercel.app`). No hardcoded URL; canonical URL via env/config.
- Local CLI: `jazz_scales.py` + LilyPond stays for the maintainer's local use, stdlib-only. Only change: optional scale column via `chord_scales.json`.
- Public, no accounts, no per-user data, no share links, no playback.

## Shared contracts (single source of truth)

- `chord_scales.json`: qualities, aliases, default + alternate scales (with notes).
- Chart text format (see README.md).
- Golden fixtures (chart → expected scale notes/spellings) run by both pytest and the TS test suite to prevent drift.

## Functional requirements

1. Scale engine (TS port of `jazz_scales.py`): degree formulas from `SCALES`, `simplify_root` enharmonic rules, transposition, chart parsing. Behaviour parity with Python.
2. Chart library: charts are files in the repo, built into the site; search by title only. No public submissions (users email the maintainer).
3. Chart editor: free text and grid (section / bar / chord / scale) synced both ways.
4. Chord → scale: resolve quality via `quality_aliases`; use the default scale unless one is given. Unrecognized chord → prompt for scale.
5. Alternates: per-chord dropdown listing alternate scales (root interval, scale, note).
6. Live preview of the staves as the chart changes.
7. Instrument transposition picker (charts always concert pitch; `--from` semantics preserved).
8. Print/PDF via browser print; fixed N staves per page.

## Security (first-class)

- Static-first: engine and rendering run client-side; library is build-time static data; no DB.
- Any API route: Vercel Firewall rate limiting, request body-size cap, strict input validation.
- Input caps (chart length, rows, field lengths) enforced client-side too.
- Security headers + CSP; no secrets in client; no user data stored.

## Roadmap

1. Engine port + parity tests (golden fixtures).
2. Chart library, manual spec (text + grid), live preview.
3. Instrument transposition picker.
4. Hardening and deploy.

## Out of scope

Accounts, saved/shared user charts, playback/audio, public submissions, server-side LilyPond (for now).

## Resolved

- N = 12 staves per page.
- Chart rows may omit the scale; both engines fall back to the `chord_scales.json` default.
- Triad qualities (`maj`, `m`) added to `chord_scales.json`.
- Input limits: see design.md §9.
