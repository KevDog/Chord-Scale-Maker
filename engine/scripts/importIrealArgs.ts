import type { IRealPlaylist } from '../src'

export type ImportArgs = Readonly<{ input: string; list: boolean; song?: string; save: boolean; force: boolean }>

export const USAGE = 'usage: npm run import-ireal -- <irealb:// link | export.html> [--list] [--song <n | title>] [--save] [--force]'

export function parseImportArgs(argv: readonly string[]): ImportArgs | string {
  let input: string | undefined
  let song: string | undefined
  const flags = { list: false, save: false, force: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string
    if (a === '--list') flags.list = true
    else if (a === '--save') flags.save = true
    else if (a === '--force') flags.force = true
    else if (a === '--song') {
      song = argv[++i]
      if (song === undefined) return '--song needs a number or a title'
    } else if (a.startsWith('--')) return `unknown option ${a}\n${USAGE}`
    else input ??= a
  }
  if (input === undefined) return USAGE
  return { input, ...flags, ...(song === undefined ? {} : { song }) }
}

export function pickSong(playlist: IRealPlaylist, song: string | undefined): number | string {
  const n = playlist.songs.length
  if (song === undefined) return n === 1 ? 0 : `${n} songs here: say which with --song <n | title> (--list lists them)`
  const i = /^\d+$/.test(song) ? Number(song) - 1 : playlist.songs.findIndex((s) => s.title.toLowerCase() === song.toLowerCase())
  return i >= 0 && i < n ? i : `no song ${JSON.stringify(song)} here (--list lists them)`
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
