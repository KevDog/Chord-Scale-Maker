/**
 * The address's "#…" as the page was first opened. While a prerendered page hydrates, the router briefly rewrites
 * the address without it, so pages that read a share link (#s=…) take it from here instead of location.hash.
 */
export default defineNuxtPlugin({
  name: 'arrival-hash',
  enforce: 'pre',
  setup() {
    return { provide: { arrivalHash: window.location.hash } }
  },
})
