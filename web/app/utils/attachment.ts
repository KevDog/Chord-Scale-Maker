import {
  ATTACHMENT_LIMITS,
  ATTACHMENT_TYPES,
  type AttachmentType,
  attachmentType,
  type ContactAttachment,
  safeFilename,
} from '../../server/utils/contactMessage'

/**
 * The contact form's attachment, made ready to send in the browser. A function takes at most 4.5 MB, so anything over
 * ATTACHMENT_LIMITS.bytes is too big to send as is: a photo is shrunk (ATTACHMENT_LIMITS.longEdge, then JPEG), a PDF
 * is turned away. The server checks it all again (server/utils/contactMessage.ts).
 */
export type ReadyAttachment = Readonly<{ attachment: ContactAttachment; size: number; shrunk: boolean }>
export type Prepared = Readonly<{ ok: true; value: ReadyAttachment }> | Readonly<{ ok: false; error: string }>

const MB = 1_000_000
const QUALITIES = [0.85, 0.7, 0.55] as const

/** the size a picture is drawn at to fit within longEdge on its longer side (never enlarged) */
export function fitWithin(width: number, height: number, longEdge: number): Readonly<{ width: number; height: number }> {
  const scale = Math.min(1, longEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export const formatSize = (bytes: number): string => (bytes < MB ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / MB).toFixed(1)} MB`)

/** the file's type, from what the browser says or else its extension */
export function fileType(file: Pick<File, 'name' | 'type'>): AttachmentType | null {
  return Object.hasOwn(ATTACHMENT_TYPES, file.type) ? (file.type as AttachmentType) : attachmentType(file.name)
}

export async function prepareAttachment(file: File): Promise<Prepared> {
  const type = fileType(file)
  if (!type) return { ok: false, error: 'Please attach a JPG, PNG or PDF.' }
  if (file.size === 0) return { ok: false, error: 'That file is empty.' }
  if (file.size > ATTACHMENT_LIMITS.original) return { ok: false, error: `The file can be at most ${ATTACHMENT_LIMITS.original / 1024 / 1024} MB.` }
  if (file.size <= ATTACHMENT_LIMITS.bytes) {
    const attachment = { filename: safeFilename(file.name, type), type, content: await base64(file) }
    return { ok: true, value: { attachment, size: file.size, shrunk: false } }
  }
  if (type === 'application/pdf') return { ok: false, error: `A PDF can be at most ${ATTACHMENT_LIMITS.bytes / MB} MB. A photo of the chart works too.` }
  const small = await shrink(file)
  if (!small) return { ok: false, error: "This picture couldn't be made small enough to send. Please try another." }
  const filename = safeFilename(file.name.replace(/\.(png|jpe?g)$/i, ''), 'image/jpeg')
  return { ok: true, value: { attachment: { filename, type: 'image/jpeg', content: await base64(small) }, size: small.size, shrunk: true } }
}

/** redraw at most longEdge on its longer side, as a JPEG on white, at the best quality that fits */
async function shrink(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return null
  const { width, height } = fitWithin(bitmap.width, bitmap.height, ATTACHMENT_LIMITS.longEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff' // a transparent PNG would otherwise turn black
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  for (const q of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', q))
    if (blob && blob.size <= ATTACHMENT_LIMITS.bytes) return blob
  }
  return null
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
