/**
 * The contact form's message (pages/contact.vue -> server/api/contact.post.ts), validated without trusting the
 * client. Pure, so it is unit-tested. Spam checks: a honeypot field people never see, and a minimum time between
 * the form appearing and its submission. Bots get a quiet "ok" so they learn nothing.
 */
export const CONTACT_LIMITS = { name: 100, email: 254, message: 5000, minMillis: 2500, maxBytes: 16_000 } as const

export type ContactMessage = Readonly<{ name: string; email: string; message: string }>
export type ContactCheck =
  | Readonly<{ ok: true; value: ContactMessage }>
  | Readonly<{ ok: false; spam: true }>
  | Readonly<{ ok: false; spam: false; errors: Readonly<Partial<Record<keyof ContactMessage, string>>> }>

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function checkContact(body: unknown, now: number): ContactCheck {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const startedAt = typeof b.startedAt === 'number' ? b.startedAt : Number.NaN
  if (text(b.website) !== '' || !(now - startedAt >= CONTACT_LIMITS.minMillis)) return { ok: false, spam: true }
  const value = { name: text(b.name), email: text(b.email), message: text(b.message) }
  const errors: Partial<Record<keyof ContactMessage, string>> = {}
  if (!value.name) errors.name = 'Please add your name.'
  else if (value.name.length > CONTACT_LIMITS.name) errors.name = `At most ${CONTACT_LIMITS.name} characters.`
  if (!EMAIL.test(value.email) || value.email.length > CONTACT_LIMITS.email) errors.email = 'Please add a valid email address.'
  if (!value.message) errors.message = 'Please write a message.'
  else if (value.message.length > CONTACT_LIMITS.message) errors.message = `At most ${CONTACT_LIMITS.message} characters.`
  return Object.keys(errors).length ? { ok: false, spam: false, errors } : { ok: true, value }
}

/** the email: plain text only (no HTML to inject into), and a one-line subject (no header injection) */
export function contactEmail(m: ContactMessage): Readonly<{ subject: string; text: string; replyTo: string }> {
  const name = m.name.replace(/[\r\n]+/g, ' ').slice(0, 80)
  return {
    subject: `Chord Scale Maker: message from ${name}`,
    text: `${m.message}\n\n— ${name} <${m.email}>\nSent from the contact form at chordscalemaker.com`,
    replyTo: m.email,
  }
}
