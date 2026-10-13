<template>
  <div class="mx-auto max-w-2xl pt-4 pb-12 sm:pt-16">
    <h1 class="font-display text-[34px]/[1.05] font-semibold tracking-[-0.025em] text-zinc-900 sm:text-[44px]/[1.05] dark:text-white">What are you playing?</h1>
    <p class="mt-3.5 max-w-[34em] text-base/6 text-pretty text-zinc-500 dark:text-zinc-400">
      <strong class="font-semibold text-zinc-800 tabular-nums dark:text-zinc-200">{{ LIBRARY.length }}</strong> standards as practice sheets: the changes with their guide tones, and a scale for every chord, written for your instrument.
    </p>
    <TuneSearch class="mt-9" />
    <RecentCharts class="mt-14" />
    <p class="mt-6 text-zinc-500 dark:text-zinc-400">
      Or <UiTextLink href="/library">browse the library A–Z</UiTextLink><template v-if="myCharts">, or <UiTextLink href="/song?new=1">start a new chart</UiTextLink></template>.
    </p>
  </div>
</template>

<script setup lang="ts">
import { LIBRARY } from '~/utils/library'
import { letterRedirect, PAGE_HEAD, seoMeta } from '~/utils/site'
import { jsonLd, webAppLd, websiteLd } from '~/utils/structuredData'

/** the home page: one large tune search (issue #243); the whole library is at /library */
useSeoMeta(seoMeta(PAGE_HEAD.index))
useHead({ script: [{ type: 'application/ld+json', innerHTML: jsonLd([websiteLd(), webAppLd()]) }] })
const myCharts = useFeature('myCharts')

// an old library link (/#letter-R): the library has moved (the hash as the page arrived: the router drops it while
// a prerendered page hydrates, plugins/arrivalHash.client.ts)
const nuxtApp = useNuxtApp()
const arrivalHash = import.meta.client && nuxtApp.isHydrating ? (nuxtApp.$arrivalHash as string) : ''
onMounted(() => {
  const to = letterRedirect(location.hash || arrivalHash)
  if (to) void navigateTo(to, { replace: true })
})
</script>
