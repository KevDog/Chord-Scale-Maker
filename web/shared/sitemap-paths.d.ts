/** the virtual module nuxt.config.ts gives server/routes/sitemap.xml.ts: the paths it lists */
declare module '#sitemap-paths' {
  const paths: readonly string[]
  export default paths
}
