// Writes the site's icons into public/ from one drawing: four note heads climbing a navy tile, the top one cut out
// of a blue corner. Run `npm run icons` after changing it (needs rsvg-convert and ImageMagick: brew install librsvg imagemagick).
// `npm run icons -- --brand ../design/brand` also writes 1024 px PNGs for profile pictures elsewhere (Patreon, Ko-fi): a
// full-bleed square that survives a circle crop, the rounded tile on transparent, and a 3000×750 cover (logo and
// wordmark, drawn in Chromium so it can use the site's Jost; the middle survives a phone's crop).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const NAVY = '#123e85' // note-800
const BLUE = '#2f6fe0' // note-500
const HEADS = [
  [7.5, 23.5, '#ffffff'],
  [13.2, 18.8, '#ffffff'],
  [18.9, 14.1, '#ffffff'],
  [24.6, 9.4, NAVY],
]

/** the 32×32 drawing; rounded: a tile with corners (favicon), else full bleed (iOS and Android crop their own); scale shrinks the notes toward the middle */
function svg({ rounded = true, scale = 1 } = {}) {
  const heads = HEADS.map(([x, y, fill]) => `<ellipse cx="${x}" cy="${y}" rx="3.7" ry="2.7" transform="rotate(-20 ${x} ${y})" fill="${fill}"/>`).join('')
  const corner = 10 * scale // the blue corner's edge, x − y = corner, moved with the notes
  const art = `<path d="M${corner} 0H32V${32 - corner}Z" fill="${BLUE}"/><g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${heads}</g>`
  const tile = rounded
    ? `<clipPath id="tile"><rect width="32" height="32" rx="7"/></clipPath><g clip-path="url(#tile)"><rect width="32" height="32" fill="${NAVY}"/>${art}</g>`
    : `<rect width="32" height="32" fill="${NAVY}"/>${art}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${tile}</svg>\n`
}

const pub = new URL('../public/', import.meta.url).pathname
const tmp = mkdtempSync(join(tmpdir(), 'icons-'))
const png = (source, size, out) => execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', out, source])
try {
  writeFileSync(join(pub, 'favicon.svg'), svg())
  writeFileSync(join(tmp, 'bleed.svg'), svg({ rounded: false }))
  writeFileSync(join(tmp, 'maskable.svg'), svg({ rounded: false, scale: 0.8 }))
  for (const size of [16, 32, 48]) png(join(pub, 'favicon.svg'), size, join(tmp, `${size}.png`))
  execFileSync('magick', [16, 32, 48].map((s) => join(tmp, `${s}.png`)).concat(join(pub, 'favicon.ico')))
  png(join(tmp, 'bleed.svg'), 180, join(pub, 'apple-touch-icon.png'))
  png(join(pub, 'favicon.svg'), 192, join(pub, 'icon-192.png'))
  png(join(pub, 'favicon.svg'), 512, join(pub, 'icon-512.png'))
  png(join(tmp, 'maskable.svg'), 512, join(pub, 'icon-maskable-512.png'))
  const brand = process.argv.indexOf('--brand')
  if (brand > 0 && process.argv[brand + 1]) {
    const dir = process.argv[brand + 1]
    writeFileSync(join(tmp, 'circle.svg'), svg({ rounded: false, scale: 0.85 }))
    png(join(tmp, 'circle.svg'), 1024, join(dir, 'chord-scale-maker-profile.png'))
    png(join(pub, 'favicon.svg'), 1024, join(dir, 'chord-scale-maker-logo.png'))
    await cover(join(dir, 'chord-scale-maker-cover.png'))
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

/** the wordmark beside the mark on navy, with the mark's blue corner echoed at the right */
async function cover(out) {
  const font = new URL('../node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2', import.meta.url).href
  const mark = new URL('../public/favicon.svg', import.meta.url).href
  const html = `<!doctype html><html><head><style>
    @font-face { font-family: Jost; src: url(${font}) format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; }
    body { width: 3000px; height: 750px; overflow: hidden; position: relative; background: ${NAVY}; font-family: Jost, sans-serif; }
    .corner { position: absolute; inset: 0; background: ${BLUE}; clip-path: polygon(2280px 0, 3000px 0, 3000px 720px); }
    .heads { position: absolute; inset: 0; opacity: 0.05; }
    .lockup { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 72px; }
    .lockup img { width: 300px; height: 300px; border-radius: 66px; box-shadow: 0 0 0 4px rgb(255 255 255 / 0.18), 0 24px 60px rgb(0 0 0 / 0.35); }
    h1 { margin: 0; color: #fff; font-size: 168px; font-weight: 800; letter-spacing: -0.025em; line-height: 1; }
    h1 span { color: #8fb4f8; }
    p { margin: 28px 0 0 6px; color: #bcd0f4; font-size: 50px; font-weight: 500; letter-spacing: 0.01em; }
  </style></head><body>
    <div class="corner"></div>
    <svg class="heads" viewBox="0 0 3000 750">${[0, 1, 2, 3, 4, 5, 6]
      .map((i) => `<ellipse cx="${260 + i * 430}" cy="${640 - i * 90}" rx="120" ry="86" transform="rotate(-20 ${260 + i * 430} ${640 - i * 90})" fill="#fff"/>`)
      .join('')}</svg>
    <div class="lockup"><img src="${mark}" alt=""><div><h1>Chord <span>Scale</span> Maker</h1><p>Practice sheets for jazz improvisation · chordscalemaker.com</p></div></div>
  </body></html>`
  const file = join(tmp, 'cover.html')
  writeFileSync(file, html)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 3000, height: 750 } })
    await page.goto(`file://${file}`)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: out })
  } finally {
    await browser.close()
  }
}
