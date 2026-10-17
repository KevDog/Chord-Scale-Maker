import type { Recording } from '@chord-scale-maker/engine'

/** a song's notable recording as it reads, "Artist, Album (Label, Year).", in parts so the album can be set in italics; an empty label or year drops out with its punctuation */
export function recordingParts(r: Recording): Readonly<{ artist: string; album: string; tail: string }> {
  const details = [r.label, r.year].filter(Boolean).join(', ')
  return { artist: r.artist, album: r.album, tail: details ? ` (${details}).` : '.' }
}

/** a video's page on YouTube, the plain link beside the player (it plays there when a label blocks embedding) */
export const youtubeUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`
