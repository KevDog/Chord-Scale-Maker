import { addCspMeta } from '../../build/csp'

/**
 * Pages are prerendered, and the prerender hook in nuxt.config.ts gives each one a hashed CSP meta. Anything the
 * server renders at request time (the 404 page for an unknown URL) gets the same here. addCspMeta leaves a page
 * that already has one unchanged.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', (response) => {
    if (typeof response.body === 'string') response.body = addCspMeta(response.body)
  })
})
