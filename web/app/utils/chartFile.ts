import { LIMITS } from '~~/engine'

/**
 * Charts as files: Download saves the chart text as a .txt (a Blob with an object URL, so no CSP change), and Open
 * reads one back. A chart file is the same plain text the editor shows, scale choices and all.
 */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export type ChartFileResult = Readonly<{ ok: true; text: string }> | Readonly<{ ok: false; error: string }>

const isText = (f: Pick<File, 'name' | 'type'>): boolean => /\.txt$/i.test(f.name) || f.type === 'text/plain' || f.type === ''

/** a chart file's text, or why it can't be opened */
export async function readChartFile(file: File): Promise<ChartFileResult> {
  if (!isText(file)) return { ok: false, error: 'Please open a chart saved as a .txt file.' }
  if (file.size > LIMITS.maxChars * 4) return { ok: false, error: `That file is too big for a chart (over ${LIMITS.maxChars.toLocaleString()} characters).` }
  let text: string
  try {
    text = (await file.text()).replace(/^\uFEFF/, '') // a byte-order mark from some editors
  } catch {
    return { ok: false, error: "That file couldn't be read. Please try it again." }
  }
  if (text.length > LIMITS.maxChars) return { ok: false, error: `That file is too big for a chart (over ${LIMITS.maxChars.toLocaleString()} characters).` }
  if (!text.trim()) return { ok: false, error: 'That file is empty.' }
  if (text.includes('\u0000')) return { ok: false, error: 'That doesn’t look like a chart: it isn’t plain text.' }
  return { ok: true, text }
}
