import type { Diagnostic, Parsed } from '../chart'

/*
 * iReal Pro links (docs/superpowers/specs/2026-10-17-ireal-import-design.md, "The format"): irealb:// (10 fields a song,
 * music scrambled) and the legacy irealbook:// (6 fields, plain), in a forum post or the app's .html export.
 */

export type IRealSong = Readonly<{ title: string; composer: string; style: string; key: string; music: string }>
export type IRealPlaylist = Readonly<{ name?: string; songs: readonly IRealSong[] }>

export const IREAL_PREFIX = '1r34LbKcu7'
const LINK = /irealb(ook)?:\/\/([^\s"'<>]+)/

/** each 50-character block swaps b[i] with b[49-i] for i in 0–4 and 10–23 while more than 51 remain; self-inverse */
export function unscramble(music: string): string {
  let out = ''
  let rest = music
  while (rest.length > 51) {
    const b = [...rest.slice(0, 50)]
    for (let i = 0; i < 24; i++) {
      if (i > 4 && i < 10) continue
      ;[b[i], b[49 - i]] = [b[49 - i] as string, b[i] as string]
    }
    out += b.join('')
    rest = rest.slice(50)
  }
  return out + rest
}

const expand = (music: string): string => music.replace(/Kcl/g, '| x').replace(/LZ/g, ' |').replace(/XyQ/g, '   ')

/** "Gentle Rain, The" -> "The Gentle Rain" */
const title = (t: string): string => t.replace(/^(.*), (The|A|An)$/, '$2 $1').trim()
/** "Hancock Herbie" -> "Herbie Hancock" (the last word first); one word stays */
function composer(c: string): string {
  const words = c.trim().split(/\s+/).filter(Boolean)
  return words.length < 2 || c.trim() === 'Composer Unknown' ? c.trim() : [words.at(-1), ...words.slice(0, -1)].join(' ')
}
/** "A-" -> "Am" */
const key = (k: string): string => k.trim().replace(/-$/, 'm')

const fatal = (message: string): Parsed<IRealPlaylist> => ({ value: { songs: [] }, diagnostics: [{ line: 1, message, fatal: true }] })

export function decodeIReal(text: string): Parsed<IRealPlaylist> {
  const m = LINK.exec(text)
  if (!m) return fatal('no iReal Pro link (irealb://…) found')
  let body: string
  try {
    body = decodeURIComponent(m[2] ?? '')
  } catch {
    return fatal('the iReal Pro link is damaged (a bad % escape): copy it again')
  }
  const fields = body.split('=')
  const legacy = m[1] === 'ook'
  const width = legacy ? 6 : 10
  const songs: IRealSong[] = []
  const diagnostics: Diagnostic[] = []
  let i = 0
  while (fields.length - i >= width) {
    const f = fields.slice(i, i + width)
    const raw = f[legacy ? 5 : 6] ?? ''
    if (!legacy && !raw.startsWith(IREAL_PREFIX)) {
      diagnostics.push({ line: songs.length + 1, message: `"${f[0]}": not an iReal Pro song (its music is missing)` })
    } else {
      const music = legacy ? raw : expand(unscramble(raw.slice(IREAL_PREFIX.length)))
      songs.push({ title: title(f[0] ?? ''), composer: composer(f[1] ?? ''), style: (f[legacy ? 2 : 3] ?? '').trim(), key: key(f[legacy ? 3 : 4] ?? ''), music })
    }
    i += width
    while (!legacy && fields[i] === '' && fields.length - i > 0) i++ // the `===` between songs
  }
  const name = fields.slice(i).join('=').trim()
  if (!songs.length) return fatal(diagnostics[0]?.message ?? 'the iReal Pro link has no songs')
  return { value: name ? { name, songs } : { songs }, diagnostics }
}
