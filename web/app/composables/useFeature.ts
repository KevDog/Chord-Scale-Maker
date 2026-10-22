/**
 * feature flags, fixed at build time from runtimeConfig.public.features (nuxt.config.ts): a new one starts off, and an
 * env var turns it on when building or in dev, e.g. NUXT_PUBLIC_FEATURES_MY_FLAG=true.
 * A new flag adds its name here.
 */
export type Feature = 'offline' | 'analyticsEvents' | 'recordings' | 'patterns' | 'cells' | 'approaches' | 'playerRange' | 'ireal' | 'chartSubmissions' | 'versions' | 'phraseCells' | 'backup' | 'alternates' | 'metronome'

export function useFeature(name: Feature): boolean {
  return (useRuntimeConfig().public.features as Readonly<Record<string, unknown>>)[name] === true
}
