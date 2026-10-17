/** the offline worker (build/sw.ts), registered once the page has loaded so its precaching doesn't slow the first visit */
export default defineNuxtPlugin(() => {
  if (!useFeature('offline') || !('serviceWorker' in navigator)) return
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {}) // none in `nuxt dev`
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
})
