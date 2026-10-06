import { describe, expect, it } from 'vitest'
import { CONTACT_LIMITS, checkContact, contactEmail } from './contactMessage'

const now = 1_000_000
const ok = { name: 'Bill', email: 'bill@example.com', message: 'Hello', website: '', startedAt: now - 5000 }

describe('checkContact', () => {
  it('accepts a real message, trimmed', () => {
    expect(checkContact({ ...ok, name: '  Bill ' }, now)).toEqual({ ok: true, value: { name: 'Bill', email: 'bill@example.com', message: 'Hello' } })
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
    const e = contactEmail({ name: 'Eve\r\nBcc: victim@example.com', email: 'eve@example.com', message: 'Hi <b>there</b>' })
    expect(e.subject).toBe('Chord Scale Maker: message from Eve Bcc: victim@example.com')
    expect(e.subject).not.toMatch(/[\r\n]/)
    expect(e.text).toContain('Hi <b>there</b>')
    expect(e.replyTo).toBe('eve@example.com')
  })
})
