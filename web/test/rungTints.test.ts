import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// cwd-relative (the cwd is web/): import.meta.url isn't a file: URL in the nuxt environment
const css = readFileSync('app/assets/css/main.css', 'utf8')
const PAPER = { light: '#ffffff', dark: '#0f1c30' } // --color-paper; dark: zinc-900

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
/** the rung tokens a block of CSS sets, in order */
const tints = (block: string): string[] => [...block.matchAll(/--color-rung-(\d): (#[0-9a-f]{6});/g)].sort((a, b) => Number(a[1]) - Number(b[1])).map((m) => m[2]!)
const theme = css.slice(css.indexOf('@theme'), css.indexOf('@layer base'))
const screenDark = css.match(/@media screen \{\s*html\.dark \{([^}]*)\}/)?.[1] ?? ''

describe('rung tints (#265)', () => {
  it('defines seven, all different, in each theme', () => {
    for (const t of [tints(theme), tints(screenDark)]) {
      expect(t).toHaveLength(7)
      expect(new Set(t).size).toBe(7)
    }
  })

  it('reads as small text on the paper: at least 4.5:1 in light and dark', () => {
    for (const c of tints(theme)) expect(contrast(c, PAPER.light)).toBeGreaterThanOrEqual(4.5)
    for (const c of tints(screenDark)) expect(contrast(c, PAPER.dark)).toBeGreaterThanOrEqual(4.5)
  })

  it('orders the rungs by lightness, so the ramp reads without hue (#277): darker outward on the light paper, brighter on the dark', () => {
    const light = tints(theme).map(luminance)
    const dark = tints(screenDark).map(luminance)
    for (let i = 1; i < 7; i++) {
      expect(light[i], `light rung ${i}`).toBeLessThan(light[i - 1]! * 0.9)
      expect(dark[i], `dark rung ${i}`).toBeGreaterThan(dark[i - 1]! * 1.1)
    }
  })

  it('keeps the dark tints off the page in print (print is light)', () => {
    expect(css).toMatch(/@media screen \{\s*html\.dark \{[^}]*--color-rung-0/)
    const print = [...css.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n')
    expect(print).not.toMatch(/--color-rung/)
  })
})
