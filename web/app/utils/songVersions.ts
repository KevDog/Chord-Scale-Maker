import { tuneOf } from './library'
import { songPath } from './site'

export type VersionChoice = Readonly<{ path: string; label: string }>

/** the song page's version picker (#411): the tune's library charts, its main first as "Main"; none for a tune of one chart */
export function versionChoices(slug: string): readonly VersionChoice[] {
  const versions = tuneOf(slug)?.versions ?? []
  return versions.length < 2 ? [] : versions.map((v) => ({ path: songPath(v.slug), label: v.label || 'Main' }))
}
