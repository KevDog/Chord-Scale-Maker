/**
 * Vercel Web Analytics: cookieless page views, with no cross-site tracking or advertising IDs, so no cookie banner.
 * Added as one plain deferred script served from this site's own origin, so the CSP (script-src and connect-src
 * 'self') needs no new sources and there's no inline script to hash. Only Vercel production builds get it: local
 * builds, `nuxt preview` and the e2e tests would otherwise request a script that only exists on Vercel.
 *
 * Mirrors what @vercel/analytics' inject() does (that package's peer range conflicts with Nuxt 4's vue-router 5):
 * the script and endpoint live under VERCEL_OBSERVABILITY_BASEPATH when Vercel sets it, else under /_vercel.
 * Web Analytics must also be enabled for the project in the Vercel dashboard.
 */
export type AnalyticsScript = Readonly<{ src: string; defer: true; 'data-endpoint'?: string }>

/** first, so the page address it sends never includes a share link's "#…" (public/analytics-before-send.js) */
const BEFORE_SEND: AnalyticsScript = { src: '/analytics-before-send.js', defer: true }

export function analyticsScripts(env: Readonly<Record<string, string | undefined>>): AnalyticsScript[] {
  if (env.VERCEL_ENV !== 'production') return []
  const base = env.VERCEL_OBSERVABILITY_BASEPATH?.replace(/\/+$/, '')
  if (!base) return [BEFORE_SEND, { src: '/_vercel/insights/script.js', defer: true }]
  const path = base.startsWith('/') ? base : `/${base}`
  return [BEFORE_SEND, { src: `${path}/insights/script.js`, defer: true, 'data-endpoint': `${path}/insights` }]
}
