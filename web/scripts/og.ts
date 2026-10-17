/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// (the DOM types: page.evaluate runs in the page)
// Draws each library song's link preview into public/og/<slug>.png (1200×630: the song's heading on paper, its
// first four bars as on the Changes sheet) and public/og/manifest.json, what each one shows (build/ogCard.ts; a test
// fails when one is missing or stale). Run `make og` after adding or editing a chart: it redraws only what changed;
// `-- --all` redraws every one. Needs ImageMagick (brew install imagemagick) to shrink them to ≤ 60 KB.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import type { ChordToken } from '@chord-scale-maker/engine'
import { libraryCharts, type OgCard, ogCard, ogHash, OG_DIR } from '../build/ogCard'

const WIDTH = 1200
const HEIGHT = 630
const STAFF = { width: 968, top: 64, gap: 12 } // the staff under the chord symbols: 5 lines `gap` apart

const escape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const symbol = (tokens: readonly ChordToken[]): string =>
  tokens.map((t) => (t.kind === 'text' ? escape(t.text) : `<sup>${t.acc === 'b' ? '♭' : '♯'}</sup>`)).join('')

/** four bars of slashes on a staff, each chord from the beat it starts on (a bar's chords split it evenly); a held bar (%) has slashes alone */
function bars(card: OgCard): string {
  const barWidth = STAFF.width / 4
  const beatWidth = barWidth / card.beats
  const mid = STAFF.top + 2 * STAFF.gap
  const lines = [0, 1, 2, 3, 4].map((i) => `<line x1="0" x2="${STAFF.width}" y1="${STAFF.top + i * STAFF.gap}" y2="${STAFF.top + i * STAFF.gap}"/>`)
  const barLines = [0, 1, 2, 3, 4].map((i) => `<line x1="${i * barWidth}" x2="${i * barWidth}" y1="${STAFF.top}" y2="${STAFF.top + 4 * STAFF.gap}"/>`)
  const slashes = card.bars.flatMap((_, b) =>
    Array.from({ length: card.beats }, (_, beat) => {
      const x = b * barWidth + (beat + 0.5) * beatWidth
      return `<path class="slash" d="M${x - 9} ${mid + STAFF.gap} L${x - 2} ${mid + STAFF.gap} L${x + 9} ${mid - STAFF.gap} L${x + 2} ${mid - STAFF.gap} Z"/>`
    }),
  )
  const chords = card.bars.flatMap((chords, b) =>
    chords
      .filter((tokens) => !(tokens.length === 1 && tokens[0]?.kind === 'text' && tokens[0].text === '%'))
      .map((tokens, i, all) => `<div class="chord" style="left:${b * barWidth + Math.floor((i * card.beats) / all.length) * beatWidth + 4}px">${symbol(tokens)}</div>`),
  )
  return `<div class="bars">${chords.join('')}<svg width="${STAFF.width}" height="${STAFF.top + 4 * STAFF.gap + 2}">${lines.join('')}${barLines.join('')}${slashes.join('')}</svg></div>`
}

const font = `file://${createRequire(import.meta.url).resolve('@fontsource-variable/jost/files/jost-latin-wght-normal.woff2')}`

function html(card: OgCard): string {
  const mark = new URL('../public/favicon.svg', import.meta.url).href
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Jost; src: url(${font}) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; }
    body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #f4f4f5; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #09090b; }
    .paper { position: absolute; left: 60px; top: 60px; width: 1080px; height: 510px; box-sizing: border-box; padding: 52px 56px; background: #fff; border-radius: 10px;
      box-shadow: 0 0 0 1px rgb(8 17 31 / .06), 0 1px 2px -1px rgb(8 17 31 / .08), 0 4px 12px rgb(8 17 31 / .06); }
    .site { position: absolute; right: 56px; top: 52px; display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 500; color: #52525b; }
    .site img { width: 32px; height: 32px; }
    h1 { margin: 0; width: 680px; font-family: Jost, sans-serif; font-size: 64px; font-weight: 700; line-height: 1.08; letter-spacing: -0.015em; }
    .composer { margin: 14px 0 0; font-size: 28px; font-weight: 500; color: #3f3f46; }
    .details { margin: 6px 0 0; font-size: 24px; color: #71717a; }
    .bars { position: absolute; left: 56px; bottom: 44px; width: ${STAFF.width}px; }
    .chord { position: absolute; top: 0; font-size: 30px; font-weight: 600; white-space: nowrap; }
    .chord sup { font-size: 0.75em; }
    line { stroke: #a1a1aa; stroke-width: 1.5; }
    .slash { fill: #18181b; }
  </style></head><body><div class="paper">
    <div class="site"><img src="${mark}" alt="">chordscalemaker.com</div>
    <h1>${escape(card.title)}</h1>
    ${card.composer ? `<p class="composer">${escape(card.composer)}</p>` : ''}
    ${card.details ? `<p class="details">${escape(card.details)}</p>` : ''}
    ${bars(card)}
  </div></body></html>`
}

const manifestPath = join(OG_DIR, 'manifest.json')
const old = (existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}) as Record<string, string>
const all = process.argv.includes('--all')
const charts = libraryCharts()
const manifest: Record<string, string> = {}
const tmp = mkdtempSync(join(tmpdir(), 'og-'))
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  for (const { slug, text } of charts) {
    const card = ogCard(text)
    const hash = ogHash(card)
    const out = join(OG_DIR, `${slug}.png`)
    manifest[slug] = hash
    if (!all && old[slug] === hash && existsSync(out)) continue
    const file = join(tmp, 'card.html')
    writeFileSync(file, html(card))
    await page.goto(`file://${file}`)
    await page.evaluate(() => document.fonts.ready)
    // a long title shrinks until it fits two lines
    await page.evaluate(() => {
      const h1 = document.querySelector('h1')
      for (let size = 64; h1 && h1.scrollHeight > size * 1.08 * 2 + 2 && size > 36; size -= 2) h1.style.fontSize = `${size - 2}px`
    })
    // a busy bar's chords move right so none overlaps the one before, all of them shrinking until they fit the staff
    await page.evaluate((width) => {
      const chords = [...document.querySelectorAll<HTMLElement>('.chord')]
      const beats = chords.map((c) => c.offsetLeft)
      for (let size = 30; size >= 18; size -= 2) {
        let end = -Infinity
        for (const [i, c] of chords.entries()) {
          c.style.fontSize = `${size}px`
          c.style.left = `${Math.max(beats[i] ?? 0, end + size * 0.4)}px`
          end = c.offsetLeft + c.offsetWidth
        }
        if (end <= width) break
      }
    }, STAFF.width + 24)
    await page.screenshot({ path: join(tmp, 'card.png') })
    execFileSync('magick', [join(tmp, 'card.png'), '-strip', '-colors', '64', `PNG8:${out}`])
    console.log(slug)
  }
} finally {
  await browser.close()
  rmSync(tmp, { recursive: true, force: true })
}
for (const slug of Object.keys(old)) if (!(slug in manifest)) rmSync(join(OG_DIR, `${slug}.png`), { force: true }) // a chart taken out
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
