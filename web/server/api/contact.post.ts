import { CONTACT_LIMITS, checkContact, contactEmail } from '../utils/contactMessage'

/**
 * The contact form's endpoint: validate, then email the site owner through Resend's API. The destination address,
 * sender and API key live in runtime config (NUXT_CONTACT_* environment variables on Vercel), never in the page.
 * NUXT_CONTACT_DRY_RUN=true (local builds and the e2e tests) validates without sending. A Vercel Firewall rule
 * rate-limits this path (docs/design.md §9).
 */
export default defineEventHandler(async (event) => {
  const origin = getRequestHeader(event, 'origin')
  if (origin && new URL(origin).host !== getRequestHost(event, { xForwardedHost: true }))
    throw createError({ statusCode: 403, statusMessage: 'Cross-site request' })
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > CONTACT_LIMITS.maxBytes)
    throw createError({ statusCode: 413, statusMessage: 'Message too large' }) // Vercel's own cap is 4.5 MB

  const check = checkContact(await readBody(event), Date.now())
  if (!check.ok && check.spam) return { ok: true } // say nothing useful to a bot
  if (!check.ok) throw createError({ statusCode: 400, statusMessage: 'Please check the form', data: { errors: check.errors } })

  const { resendApiKey, to, from, dryRun } = useRuntimeConfig().contact
  if (dryRun) return { ok: true }
  if (!resendApiKey || !to || !from) throw createError({ statusCode: 503, statusMessage: 'The contact form is not set up yet' })

  const mail = contactEmail(check.value)
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: mail.replyTo, subject: mail.subject, text: mail.text, attachments: mail.attachments }),
  }).catch(() => null)
  if (!sent?.ok) throw createError({ statusCode: 502, statusMessage: 'The message could not be sent' })
  return { ok: true }
})
