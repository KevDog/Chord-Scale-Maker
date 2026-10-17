/** a Nuxt route pattern as Vercel Web Analytics groups routes: /song/:slug? -> /song/[slug], a catch-all -> [...name] */
export const vercelRoute = (pattern: string): string =>
  pattern.replace(/:(\w+)\([^)]*\)\*/g, '[...$1]').replace(/:(\w+)\??/g, '[$1]')
