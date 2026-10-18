import { parseArgs } from 'node:util'
import type { IRealPlaylist } from '@chord-scale-maker/engine'

/** the header lines csm add can set, one flag each */
export type HeaderFlag = 'composer' | 'form' | 'style' | 'kind' | 'aka' | 'recording' | 'source'
export const HEADER_FLAGS: readonly HeaderFlag[] = ['composer', 'form', 'style', 'kind', 'aka', 'recording', 'source']
const KINDS = ['tune', 'form', 'exercise']

export type AddArgs = Readonly<{ input: string; list: boolean; song?: string; force: boolean; print: boolean; overrides: Readonly<Partial<Record<HeaderFlag, string>>> }>

export const USAGE = [
  'usage: csm add <irealb:// link | export.html> [--list] [--song <n | title>] [--force] [--print]',
  '               [--composer …] [--form …] [--style …] [--kind tune|form|exercise] [--aka …] [--recording …] [--source …]',
].join('\n')

/** csm add's arguments, or the usage error */
export function parseAddArgs(argv: readonly string[]): AddArgs | string {
  let parsed
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        list: { type: 'boolean' },
        song: { type: 'string' },
        force: { type: 'boolean' },
        print: { type: 'boolean' },
        ...Object.fromEntries(HEADER_FLAGS.map((f) => [f, { type: 'string' as const }])),
      },
    })
  } catch (e) {
    return `${(e as Error).message}\n${USAGE}`
  }
  const { values, positionals } = parsed
  const input = positionals[0]
  if (input === undefined) return USAGE
  const all: Readonly<Record<string, string | boolean | undefined>> = values
  const str = (k: string): string | undefined => (typeof all[k] === 'string' ? all[k] : undefined)
  const song = str('song')
  const kind = str('kind')
  if (kind !== undefined && !KINDS.includes(kind)) return `--kind is tune, form or exercise\n${USAGE}`
  const overrides = Object.fromEntries(HEADER_FLAGS.flatMap((f) => (str(f) === undefined ? [] : [[f, str(f)]])))
  return { input, list: !!values.list, ...(song === undefined ? {} : { song }), force: !!values.force, print: !!values.print, overrides }
}

export function pickSong(playlist: IRealPlaylist, song: string | undefined): number | string {
  const n = playlist.songs.length
  if (song === undefined) return n === 1 ? 0 : `${n} songs here: say which with --song <n | title> (--list lists them)`
  const byNumber = /^\d+$/.test(song) ? Number(song) - 1 : -1
  const i = byNumber >= 0 && byNumber < n ? byNumber : playlist.songs.findIndex((s) => s.title.toLowerCase() === song.toLowerCase())
  return i >= 0 ? i : `no song ${JSON.stringify(song)} here (--list lists them)`
}

/** as the library's files are named: lowercase, hyphens, no punctuation */
export const chartSlug = (title: string): string =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** the slug to save under, or why there is none (a title with no ASCII letters or digits) */
export const saveName = (title: string): { slug: string } | { error: string } => {
  const slug = chartSlug(title)
  return slug ? { slug } : { error: `no file name from the title "${title}"` }
}
