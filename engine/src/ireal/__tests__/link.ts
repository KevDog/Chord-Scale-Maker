import { IREAL_PREFIX, unscramble } from '../decode'

export type RawSong = Readonly<{ title: string; composer?: string; style?: string; key?: string; music: string }>

/** an irealb:// link as the app writes one; `music` is readable (the swap is self-inverse, so it scrambles too) */
export function irealLink(songs: readonly RawSong[], name?: string, encode = false): string {
  const song = (s: RawSong) =>
    [s.title, s.composer ?? 'Composer Unknown', '', s.style ?? 'Medium Swing', s.key ?? 'C', '', IREAL_PREFIX + unscramble(s.music), '', '0', '0'].join('=')
  const body = songs.map(song).join('===') + (name ? `===${name}` : '')
  return 'irealb://' + (encode ? encodeURIComponent(body) : encodeURI(body))
}
