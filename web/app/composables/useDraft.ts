import { LIMITS } from '~~/engine'

const KEY = 'csm-draft'

export const STARTER_CHART = `title: Untitled
subtitle:

# section | bar | chord | scale (optional)
A | 1 | Dm7
A | 2 | G7
A | 3 | CMaj7
`

/** the editor's last text, kept in this browser only (nothing is sent anywhere) */
export const loadDraft = (): string | null => readStored(KEY)

export function saveDraft(text: string): void {
  if (text.length > LIMITS.maxChars) return // keep the last draft that fit; don't write megabytes per keystroke
  writeStored(KEY, text)
}
