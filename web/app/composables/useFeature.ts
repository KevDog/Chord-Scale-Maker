/**
 * feature flags, fixed at build time from runtimeConfig.public.features (nuxt.config.ts).
 * Turn one on with an env var when building or in dev, e.g. NUXT_PUBLIC_FEATURES_NEW_CHART=true.
 */
export type Feature = 'newChart'

export function useFeature(name: Feature): boolean {
  return useRuntimeConfig().public.features[name] === true
}
