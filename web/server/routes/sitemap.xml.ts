import paths from '#sitemap-paths'
import { sitemapXml } from '../../app/utils/sitemap'

/** prerendered to a static file (nuxt.config.ts); the paths come from the config, which also prerenders them */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/xml')
  return sitemapXml(paths)
})
