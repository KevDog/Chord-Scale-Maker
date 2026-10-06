/**
 * The contact form's message (pages/contact.vue -> server/api/contact.post.ts), validated without trusting the
 * client. Pure, so it is unit-tested. Spam checks: a honeypot field people never see, and a minimum time between
 * the form appearing and its submission. Bots get a quiet "ok" so they learn nothing.
 */
export const ATTACHMENT_LIMITS = {
  bytes: 3_000_000, // what is sent: a Vercel function takes at most 4.5 MB, and base64 adds a third
  original: 10 * 1024 * 1024, // what may be chosen: photos are shrunk to fit `bytes` before sending
  longEdge: 2500, // a shrunk photo's longest side, in pixels: still sharp for a chart
  filename: 100,
} as const
export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  message: 5000,
  minMillis: 2500,
  maxBytes: 16_000 + Math.ceil(ATTACHMENT_LIMITS.bytes / 3) * 4, // the text fields plus a base64 attachment
} as const

/** the file types an attachment may be, by MIME type, with their extensions (the first is the one used) */
export const ATTACHMENT_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/pdf': ['pdf'],
} as const satisfies Record<string, readonly string[]>
export type AttachmentType = keyof typeof ATTACHMENT_TYPES

/** content is base64 */
export type ContactAttachment = Readonly<{ filename: string; type: AttachmentType; content: string }>
export type ContactMessage = Readonly<{ name: string; email: string; message: string; attachment: ContactAttachment | null }>
export type ContactField = keyof ContactMessage
export type ContactCheck =
  | Readonly<{ ok: true; value: ContactMessage }>
  | Readonly<{ ok: false; spam: true }>
  | Readonly<{ ok: false; spam: false; errors: Readonly<Partial<Record<ContactField, string>>> }>

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function checkContact(body: unknown, now: number): ContactCheck {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const startedAt = typeof b.startedAt === 'number' ? b.startedAt : Number.NaN
  if (text(b.website) !== '' || !(now - startedAt >= CONTACT_LIMITS.minMillis)) return { ok: false, spam: true }
  const attachment = checkAttachment(b.attachment)
  const value = { name: text(b.name), email: text(b.email), message: text(b.message), attachment: typeof attachment === 'string' ? null : attachment }
  const errors: Partial<Record<ContactField, string>> = {}
  if (!value.name) errors.name = 'Please add your name.'
  else if (value.name.length > CONTACT_LIMITS.name) errors.name = `At most ${CONTACT_LIMITS.name} characters.`
  if (!EMAIL.test(value.email) || value.email.length > CONTACT_LIMITS.email) errors.email = 'Please add a valid email address.'
  if (!value.message) errors.message = 'Please write a message.'
  else if (value.message.length > CONTACT_LIMITS.message) errors.message = `At most ${CONTACT_LIMITS.message} characters.`
  if (typeof attachment === 'string') errors.attachment = attachment
  return Object.keys(errors).length ? { ok: false, spam: false, errors } : { ok: true, value }
}

/** the type a file name's extension implies, if it is one we take */
export function attachmentType(filename: string): AttachmentType | null {
  const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? ''
  const types = Object.keys(ATTACHMENT_TYPES) as AttachmentType[]
  return types.find((t) => (ATTACHMENT_TYPES[t] as readonly string[]).includes(ext)) ?? null
}

/** each type's first bytes, so a renamed file of another kind is turned away */
const MAGIC: Record<AttachmentType, readonly number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
}
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/** a file name safe for an email header: no path, no control or quoting characters, the type's extension */
export function safeFilename(name: string, type: AttachmentType): string {
  const exts: readonly string[] = ATTACHMENT_TYPES[type]
  const base = (name.split(/[\\/]/).pop() ?? '')
    // eslint-disable-next-line no-control-regex -- control characters are exactly what is removed
    .replace(/[\u0000-\u001f\u007f"<>:*?|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const ext = /\.([a-z0-9]+)$/i.exec(base)?.[1]?.toLowerCase() ?? ''
  const stem = (exts.includes(ext) ? base.slice(0, -ext.length - 1) : base).trim().slice(0, ATTACHMENT_LIMITS.filename - 5) || 'attachment'
  return `${stem}.${exts.includes(ext) ? ext : exts[0]}`
}

/** null for no attachment, the attachment, or what is wrong with it */
export function checkAttachment(v: unknown): ContactAttachment | null | string {
  if (v === undefined || v === null) return null
  const a = (typeof v === 'object' ? v : {}) as Record<string, unknown>
  const type = typeof a.type === 'string' && Object.hasOwn(ATTACHMENT_TYPES, a.type) ? (a.type as AttachmentType) : null
  if (!type) return 'Please attach a JPG, PNG or PDF.'
  const content = typeof a.content === 'string' ? a.content : ''
  if (!content || content.length % 4 !== 0 || !BASE64.test(content)) return "The attachment couldn't be read. Please try it again."
  const bytes = (content.length / 4) * 3 - (content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0)
  if (bytes > ATTACHMENT_LIMITS.bytes) return `The attachment can be at most ${ATTACHMENT_LIMITS.bytes / 1_000_000} MB.`
  const head = atob(content.slice(0, 12))
  if (!MAGIC[type].every((byte, i) => head.charCodeAt(i) === byte)) return 'Please attach a JPG, PNG or PDF.'
  return { filename: safeFilename(typeof a.filename === 'string' ? a.filename : '', type), type, content }
}

/** the email: plain text only (no HTML to inject into), and a one-line subject (no header injection) */
export function contactEmail(
  m: ContactMessage,
): Readonly<{ subject: string; text: string; replyTo: string; attachments: readonly Readonly<{ filename: string; content: string }>[] }> {
  const name = m.name.replace(/[\r\n]+/g, ' ').slice(0, 80)
  return {
    subject: `Chord Scale Maker: message from ${name}`,
    text: `${m.message}\n\n— ${name} <${m.email}>${m.attachment ? `\nAttached: ${m.attachment.filename}` : ''}\nSent from the contact form at chordscalemaker.com`,
    replyTo: m.email,
    attachments: m.attachment ? [{ filename: m.attachment.filename, content: m.attachment.content }] : [],
  }
}
