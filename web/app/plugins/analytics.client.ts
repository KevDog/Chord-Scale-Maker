import { vercelRoute } from '~/utils/analyticsRoute'

/** one page view per page shown, with its route (the script's own tracking is off: build/analytics.ts) */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('page:finish', () => {
    const va = (window as { va?: (...a: unknown[]) => void }).va
    const pattern = useRoute().matched.at(-1)?.path
    if (va && pattern) va('pageview', { route: vercelRoute(pattern), path: location.pathname })
  })
})
