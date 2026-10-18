import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chartOutline, type ChordToken, isSyncCopy, tuneSummary } from '@chord-scale-maker/engine'
import { libraryDetails } from '../app/utils/libraryIndex'
import { publishedChart } from '../app/utils/published'

const CHARTS_DIR = new URL('../../engine/charts/', import.meta.url).pathname
/** where scripts/og.ts writes a song's link preview (<slug>.png) and the manifest of what each one shows */
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

/** the manifest's entry for a card: changes when the image would */
export const ogHash = (card: OgCard): string => createHash('sha1').update(JSON.stringify(card)).digest('hex')
