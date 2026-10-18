/**
 * Checks each library chart's youtube: video still plays embedded (docs/superpowers/specs/2026-10-17-notable-recordings.md
 * §7), from YouTube's oEmbed: 200 → ✓ with its uploader (an official channel or a "… - Topic"), 401 → embedding
 * disabled, 404 → gone; a `(link only)` video is meant to 401, and is reported if it now embeds (drop the flag).
 * Needs the network, so it's run by hand (before a milestone, and when adding a youtube:), not in CI; exits 1 on any ✗.  npm run check-recordings -w engine
 */
import { readdirSync, readFileSync } from 'node:fs'
import { chartYoutube, isSyncCopy, parseChart } from '../src'

const CHARTS = new URL('../charts/', import.meta.url).pathname

const videos = readdirSync(CHARTS)
  .filter((f) => f.endsWith('.txt') && !isSyncCopy(f))
  .flatMap((f) => {
    const video = chartYoutube(parseChart(readFileSync(CHARTS + f, 'utf8')).value)
    return video ? [{ slug: f.replace(/\.txt$/, ''), ...video }] : []
  })

let bad = 0
for (const { slug, id, embeddable } of videos) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'ChordScaleMaker/1 (+https://www.chordscalemaker.com)' } })
  if (!embeddable) {
    if (res.status === 401) console.log(`✓ ${slug} ${id} (link only)`)
    else {
      bad++
      console.log(`✗ ${slug} ${id} ${res.status} (link only, ${res.ok ? 'now plays embedded: drop the flag' : 'gone'})`)
    }
  } else if (res.ok) {
    const { author_name: author } = (await res.json()) as { author_name?: string }
    console.log(`✓ ${slug} ${id} ${author ?? ''}`)
  } else {
    bad++
    console.log(`✗ ${slug} ${id} ${res.status}${res.status === 401 ? ' (embedding disabled)' : res.status === 404 ? ' (gone)' : ''}`)
  }
}
console.log(`${videos.length} videos, ${bad} not playable embedded`)
process.exitCode = bad ? 1 : 0
