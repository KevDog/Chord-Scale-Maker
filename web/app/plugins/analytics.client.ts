import { vercelRoute } from '~/utils/analyticsRoute'

/**
 * one page view per page shown, with its route (the script's own tracking is off: build/analytics.ts). Read a tick
 * after page:finish, from the router: a prerendered /song?… hydrates as a bare /song (which may flip the address
 * to /library) before Nuxt restores its real address, and finishes twice on the way; a repeat of the last path is skipped.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  let last = ''
  nuxtApp.hook('page:finish', () => {
    setTimeout(() => {
      const va = (window as { va?: (...a: unknown[]) => void }).va
      const { matched, path } = router.currentRoute.value
      const pattern = matched.at(-1)?.path
      if (!va || !pattern || path === last) return
      last = path
      va('pageview', { route: vercelRoute(pattern), path })
    })
  })
})
