/**
 * feature flags, fixed at build time from runtimeConfig.public.features (nuxt.config.ts).
 * Turn one on with an env var when building or in dev, e.g. NUXT_PUBLIC_FEATURES_MY_CHARTS=true.
 */
export type Feature = 'myCharts' | 'guideTones' | 'practice' | 'scaleLevels'

export function useFeature(name: Feature): boolean {
  return useRuntimeConfig().public.features[name] === true
}
