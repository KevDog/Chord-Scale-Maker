<template>
  <div class="max-w-5xl pt-4 pb-12 sm:pt-6">
    <div class="max-w-2xl">
      <h1 class="font-display text-[34px]/[1.05] font-semibold tracking-[-0.025em] text-zinc-900 sm:text-[44px]/[1.05] dark:text-white">What are you playing?</h1>
      <p class="mt-3.5 max-w-[34em] text-base/6 text-pretty text-zinc-500 dark:text-zinc-400">
        <strong class="font-semibold text-zinc-800 tabular-nums dark:text-zinc-200">{{ LIBRARY.length }}</strong> standards as practice sheets: the changes with their guide tones, and a scale and an arpeggio for every chord, written for your instrument.
      </p>
      <TuneSearch class="mt-9" />
    </div>
    <!-- recents beside the tune of the day; on a first visit (no recents) the tune of the day moves under the search -->
    <div class="mt-10 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-8">
      <RecentCharts class="min-w-0 lg:flex-1" />
      <TuneOfTheDay class="lg:w-80 lg:shrink-0" />
    </div>

    <section aria-labelledby="about-heading" class="mt-14 grid gap-x-12 gap-y-8 border-t border-zinc-950/5 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] dark:border-white/5">
      <div>
        <h2 id="about-heading" class="font-display text-[28px]/[1.15] font-semibold tracking-[-0.02em] text-balance text-zinc-900 dark:text-white">A lead sheet that teaches you the tune</h2>
        <p class="mt-3 text-[15px]/6 text-pretty text-zinc-500 dark:text-zinc-400">
          Chord Scale Maker turns a chord chart into practice sheets for improvising. Pick a tune and your instrument, and every sheet is written for it, in the tune’s key or any other. Play from the page or print it. It’s free, with no ads and no accounts.
        </p>
      </div>
      <div class="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <div v-for="u in USES" :key="u.title">
          <h3 class="font-display text-[17px]/6 font-semibold text-zinc-900 dark:text-white">{{ u.title }}</h3>
          <p class="mt-1.5 max-w-[36em] text-sm/[22px] text-pretty text-zinc-500 dark:text-zinc-400">{{ u.text }}</p>
        </div>
        <div>
          <h3 class="font-display text-[17px]/6 font-semibold text-zinc-900 dark:text-white">Bring your own tune</h3>
          <p class="mt-1.5 max-w-[36em] text-sm/[22px] text-pretty text-zinc-500 dark:text-zinc-400">
            Not in the library?
            Start a new chart, type the changes into the sheet, and it’s saved in this browser. Or <UiTextLink href="/contact">ask for it</UiTextLink> and it may join the library.
          </p>
        </div>
      </div>
    </section>

    <p class="mt-10 text-zinc-500 dark:text-zinc-400">
      Or <UiTextLink href="/library">browse the library A–Z</UiTextLink>, or <UiTextLink href="/song?new=1">start a new chart</UiTextLink>.
    </p>
  </div>
</template>

<script setup lang="ts">
import { LIBRARY } from '~/utils/library'
import { letterRedirect, PAGE_HEAD, seoMeta } from '~/utils/site'
import { jsonLd, webAppLd, websiteLd } from '~/utils/structuredData'

/** the home page: one large tune search (issue #243), recents and a tune of the day, what the site does (#249); the
 * whole library is at /library */
useSeoMeta(seoMeta(PAGE_HEAD.index))
useHead({ script: [{ type: 'application/ld+json', innerHTML: jsonLd([websiteLd(), webAppLd()]) }] })

/** what the site does (issue #249); the last, Bring your own tune, has links */
const USES = [
  { title: 'Follow the changes', text: 'The Changes is a study lead sheet: the tune’s chords bar by bar. Put a guide tone line from the 3rd or the 7th on the staff, or run a 7th chord arpeggio through every change: up, down, from an inversion, or voice-led.' },
  { title: 'Learn a scale for every chord', text: 'The Scales gives each chord its own staff with the scale that fits it, chosen from how the chord works in the key. Spell them all from one note, or highlight a few notes and improvise with just those.' },
  { title: 'Run the arpeggios', text: 'The Arpeggios sheet gives each chord its arpeggio on its own staff: the four chord tones, or extended up through the 9th, 11th and 13th from its scale. Play them up, down, or up and down.' },
] as const

// an old library link (/#letter-R): the library has moved (the hash as the page arrived: the router drops it while
// a prerendered page hydrates, plugins/arrivalHash.client.ts)
const nuxtApp = useNuxtApp()
const arrivalHash = import.meta.client && nuxtApp.isHydrating ? (nuxtApp.$arrivalHash as string) : ''
onMounted(() => {
  const to = letterRedirect(location.hash || arrivalHash)
  if (to) void navigateTo(to, { replace: true })
})
</script>
