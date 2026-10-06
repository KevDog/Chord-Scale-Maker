import { describe, expect, it } from 'vitest'
import { fileType, fitWithin, formatSize, prepareAttachment } from '~/utils/attachment'

const file = (bytes: number[] | Uint8Array, name: string, type = ''): File => new File([new Uint8Array(bytes)], name, { type })
const PDF = [...'%PDF-1.7 tiny'].map((c) => c.charCodeAt(0))

describe('attachment', () => {
  it('fits a picture within the long edge, never enlarging it', () => {
    expect(fitWithin(5000, 4000, 2500)).toEqual({ width: 2500, height: 2000 })
    expect(fitWithin(3000, 6000, 2500)).toEqual({ width: 1250, height: 2500 })
    expect(fitWithin(800, 600, 2500)).toEqual({ width: 800, height: 600 })
  })

  it('formats sizes and reads the type from the browser or the extension', () => {
    expect([500, 1_234_000, 3_000_000].map(formatSize)).toEqual(['1 KB', '1.2 MB', '3.0 MB'])
    expect(fileType({ name: 'x', type: 'image/png' })).toBe('image/png')
    expect(fileType({ name: 'scan.JPEG', type: '' })).toBe('image/jpeg')
    expect(fileType({ name: 'a.gif', type: 'image/gif' })).toBeNull()
  })

  it('sends a small file as is, in base64', async () => {
    const r = await prepareAttachment(file(PDF, 'Peace Piece.pdf', 'application/pdf'))
    expect(r).toEqual({
      ok: true,
      value: { attachment: { filename: 'Peace Piece.pdf', type: 'application/pdf', content: btoa(String.fromCharCode(...PDF)) }, size: PDF.length, shrunk: false },
    })
  })

  it('turns away other types, empty files, PDFs over 3 MB and anything over 10 MB', async () => {
    expect(await prepareAttachment(file([1, 2], 'a.gif', 'image/gif'))).toMatchObject({ ok: false, error: /JPG, PNG or PDF/ })
    expect(await prepareAttachment(file([], 'a.pdf'))).toMatchObject({ ok: false, error: /empty/ })
    expect(await prepareAttachment(file(new Uint8Array(3_000_001), 'a.pdf'))).toMatchObject({ ok: false, error: /PDF can be at most 3 MB/ })
    expect(await prepareAttachment(file(new Uint8Array(10 * 1024 * 1024 + 1), 'a.png'))).toMatchObject({ ok: false, error: /at most 10 MB/ })
  })
})
