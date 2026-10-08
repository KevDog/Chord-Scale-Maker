import { describe, expect, it } from 'vitest'
import { ATTACHMENT_LIMITS, attachmentType, CONTACT_LIMITS, checkAttachment, checkContact, contactEmail, safeFilename } from './contactMessage'

const now = 1_000_000
const b64 = (bytes: readonly number[], pad = 0): string => btoa(String.fromCharCode(...bytes, ...Array<number>(pad).fill(0)))
const PDF = b64([...'%PDF-1.7'].map((c) => c.charCodeAt(0)), 4)
const PNG = b64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 4)
const JPG = b64([0xff, 0xd8, 0xff, 0xe0], 8)
const ok = { name: 'Bill', email: 'bill@example.com', message: 'Hello', website: '', startedAt: now - 5000 }

describe('checkContact', () => {
  it('accepts a real message, trimmed', () => {
    expect(checkContact({ ...ok, name: '  Bill ' }, now)).toEqual({ ok: true, value: { name: 'Bill', email: 'bill@example.com', message: 'Hello', attachment: null } })
  })

  it('treats a filled honeypot, a too-quick submit or a missing timestamp as spam', () => {
    expect(checkContact({ ...ok, website: 'http://spam' }, now)).toEqual({ ok: false, spam: true })
    expect(checkContact({ ...ok, startedAt: now - 500 }, now)).toEqual({ ok: false, spam: true })
    expect(checkContact({ ...ok, startedAt: 'yesterday' }, now)).toEqual({ ok: false, spam: true })
    expect(checkContact(null, now)).toEqual({ ok: false, spam: true })
  })

  it('reports each field that needs fixing', () => {
    const r = checkContact({ ...ok, name: '', email: 'not an email', message: 'x'.repeat(CONTACT_LIMITS.message + 1) }, now)
    expect(r.ok === false && !r.spam && Object.keys(r.errors)).toEqual(['name', 'email', 'message'])
    expect(checkContact({ ...ok, email: 'a@b' }, now).ok).toBe(false)
    expect(checkContact({ ...ok, email: 'x <a@b.com>' }, now).ok).toBe(false)
  })
})

describe('contactEmail', () => {
  it('is plain text with a single-line subject and the sender as reply-to', () => {
    const e = contactEmail({ name: 'Eve\r\nBcc: victim@example.com', email: 'eve@example.com', message: 'Hi <b>there</b>', attachment: null })
    expect(e.subject).toBe('Chord Scale Maker: message from Eve Bcc: victim@example.com')
    expect(e.subject).not.toMatch(/[\r\n]/)
    expect(e.text).toContain('Hi <b>there</b>')
    expect(e.replyTo).toBe('eve@example.com')
    expect(e.attachments).toEqual([])
  })

  it('carries the attachment and names it in the text', () => {
    const attachment = { filename: 'chart.pdf', type: 'application/pdf', content: PDF } as const
    const e = contactEmail({ name: 'Bill', email: 'bill@example.com', message: 'Here', attachment })
    expect(e.attachments).toEqual([{ filename: 'chart.pdf', content: PDF }])
    expect(e.text).toContain('Attached: chart.pdf')
    expect(contactEmail({ name: 'Bill', email: 'bill@example.com', message: 'Hi', attachment: null }, '2026.10.07 · 1e2bea5').text).toContain(
      'chordscalemaker.com (version 2026.10.07 · 1e2bea5)',
    )
  })
})

describe('checkAttachment', () => {
  it('takes none, or a JPG, PNG or PDF whose bytes match its type', () => {
    expect(checkAttachment(undefined)).toBeNull()
    expect(checkAttachment({ filename: 'a.pdf', type: 'application/pdf', content: PDF })).toEqual({ filename: 'a.pdf', type: 'application/pdf', content: PDF })
    expect(checkAttachment({ filename: 'a.png', type: 'image/png', content: PNG })).toMatchObject({ type: 'image/png' })
    expect(checkAttachment({ filename: 'a.jpeg', type: 'image/jpeg', content: JPG })).toMatchObject({ filename: 'a.jpeg' })
  })

  it('turns away other types, renamed files, bad base64 and anything over the limit', () => {
    expect(checkAttachment({ filename: 'a.gif', type: 'image/gif', content: PNG })).toMatch(/JPG, PNG or PDF/)
    expect(checkAttachment({ filename: 'a', type: 'toString', content: PNG })).toMatch(/JPG, PNG or PDF/)
    expect(checkAttachment({ filename: 'a.pdf', type: 'application/pdf', content: PNG })).toMatch(/JPG, PNG or PDF/)
    expect(checkAttachment({ filename: 'a.pdf', type: 'application/pdf', content: 'not base64!' })).toMatch(/couldn't be read/)
    expect(checkAttachment('a.pdf')).toMatch(/JPG, PNG or PDF/)
    const big = PDF + 'A'.repeat(Math.ceil(ATTACHMENT_LIMITS.bytes / 3) * 4)
    expect(checkAttachment({ filename: 'a.pdf', type: 'application/pdf', content: big })).toMatch(/at most 3 MB/)
  })

  it('is reported with the other fields', () => {
    const r = checkContact({ ...ok, attachment: { filename: 'x.exe', type: 'application/x-msdownload', content: PDF } }, now)
    expect(r.ok === false && !r.spam && r.errors.attachment).toMatch(/JPG, PNG or PDF/)
  })

  it('names files safely, with the extension of their type', () => {
    expect(safeFilename('C:\\charts\\Peace Piece.PDF', 'application/pdf')).toBe('Peace Piece.pdf')
    expect(safeFilename('../../etc/passwd', 'application/pdf')).toBe('passwd.pdf')
    expect(safeFilename('a"\r\nBcc: x.png', 'image/png')).toBe('aBcc x.png')
    expect(safeFilename('photo.heic', 'image/jpeg')).toBe('photo.heic.jpg')
    expect(safeFilename('', 'image/jpeg')).toBe('attachment.jpg')
    expect(safeFilename(`${'x'.repeat(300)}.pdf`, 'application/pdf').length).toBeLessThanOrEqual(ATTACHMENT_LIMITS.filename)
  })

  it('reads a type from an extension', () => {
    expect(['a.JPG', 'b.jpeg', 'c.png', 'd.pdf', 'e.gif', 'f'].map(attachmentType)).toEqual(['image/jpeg', 'image/jpeg', 'image/png', 'application/pdf', null, null])
  })
})
