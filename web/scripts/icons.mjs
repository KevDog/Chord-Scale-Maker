// Writes the site's icons into public/ from one drawing: four note heads climbing a navy tile, the top one cut out
// of a blue corner. Run `npm run icons` after changing it (needs rsvg-convert and ImageMagick: brew install librsvg imagemagick).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
