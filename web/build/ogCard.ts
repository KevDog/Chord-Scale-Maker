import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONCERT, chartOutline, chordFormula, chordFromSlug, chordScales, chordTitle, type ChordToken, chordTokens, glyphs, isSyncCopy, noteText, parseRoot, rootName, spellFrom, tuneSummary } from '@chord-scale-maker/engine'
import { libraryDetails } from '../app/utils/libraryIndex'
import { publishedChart } from '../app/utils/published'

const CHARTS_DIR = new URL('../../engine/charts/', import.meta.url).pathname
/** where scripts/og.ts writes a song's link preview (<slug>.png), a chord page's (chords/<slug>.png) and the manifest of what each one shows */
export const OG_DIR = new URL('../public/og/', import.meta.url).pathname

/** a song's link preview: its heading, and its first four bars as chord symbols over slashes, `beats` a bar */
export type OgCard = Readonly<{ title: string; composer: string; details: string; beats: number; bars: readonly (readonly (readonly ChordToken[])[])[] }>

/** the library's charts as the site ships them (the app's LIBRARY, read from disk) */
export const libraryCharts = (): readonly Readonly<{ slug: string; text: string }>[] =>
  readdirSync(CHARTS_DIR)
    .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
    .map((f) => ({ slug: f.replace(/\.txt$/, ''), text: publishedChart(readFileSync(join(CHARTS_DIR, f), 'utf8')) }))

export function ogCard(text: string): OgCard {
  const summary = tuneSummary(text)
  return {
    // a version is named by its label, as on its page (#411)
    title: summary.version ? `${summary.title} (${summary.version})` : summary.title,
    composer: summary.composer,
    details: libraryDetails(summary),
    beats: Number(/^(\d+)\//.exec(summary.time)?.[1] ?? 4),
    bars: chartOutline(text).flatMap((s) => s.bars).slice(0, 4).map((b) => b.chords),
  }
}

/** a chord page's link preview (#524): the chord on C, its name, formula and notes, and its first scales */
export type ChordOgCard = Readonly<{ symbol: readonly ChordToken[]; title: string; formula: string; notes: string; scales: string }>

/** at most this many scales on a chord's card, the page's first (none outside) */
const CARD_SCALES = 4

export function chordOgCard(slug: string): ChordOgCard | null {
  const quality = chordFromSlug(slug)
  if (!quality) return null
  return {
    symbol: chordTokens(CONCERT, `C${quality === 'maj' ? '' : quality}`), // as chordPage's chordOnC: this file can't load the app's library
    title: `${chordTitle(quality)} chord`,
    formula: glyphs(chordFormula(quality)),
    notes: spellFrom(parseRoot('C'), chordFormula(quality))
      .map((n) => noteText(rootName(n)))
      .join(' '),
    scales: chordScales(quality)
      .filter((o) => !o.outside)
      .slice(0, CARD_SCALES)
      .map((o) => glyphs(o.scale))
      .join(' · '),
  }
}

/** the manifest's entry for a card: changes when the image would */
export const ogHash = (card: OgCard | ChordOgCard): string => createHash('sha1').update(JSON.stringify(card)).digest('hex')
