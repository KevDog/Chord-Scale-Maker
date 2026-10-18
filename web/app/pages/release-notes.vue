<template>
  <div class="lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12">
    <!-- from lg: the text, and its index in a column beside it -->
    <article class="max-w-3xl space-y-12">
      <header class="space-y-3">
        <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">Release notes</p>
        <UiHeading>What's new</UiHeading>
        <UiText>
          What changed, newest first. Each line links to the change itself on GitHub, if you're curious how it was made.
          <UiTextLink href="/help">Help</UiTextLink> says how to use it all, and
          <UiTextLink href="/how-it-decides">How it decides</UiTextLink> why it chooses what it does.
        </UiText>
        <PageIndex :sections="MONTHS" />
      </header>

      <section v-for="m in MONTHS" :key="m.id" class="scroll-mt-6 space-y-8" :aria-labelledby="m.id">
        <UiSubheading :id="m.id" class="scroll-mt-6">{{ m.title }}</UiSubheading>
        <section v-for="n in m.notes" :key="n.date" class="space-y-3" :aria-labelledby="n.date" :data-release="n.date">
          <UiSubheading :id="n.date" :level="3" class="scroll-mt-6">{{ longDate(n.date) }}</UiSubheading>
          <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
            <li v-for="(i, k) in n.items" :key="k">
              {{ i.text }}<template v-if="i.pr"> <UiTextLink :href="`${REPO}/pull/${i.pr}`">#{{ i.pr }}</UiTextLink></template>
            </li>
          </ul>
        </section>
      </section>
    </article>
    <PageIndex :sections="MONTHS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { RELEASE_NOTES, type ReleaseNote } from '~/utils/releaseNotes'
import { PAGE_HEAD, seoMeta } from '~/utils/site'

const REPO = 'https://github.com/KevDog/Chord-Scale-Maker'
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** '2026-10-18' → '18 October 2026', without the viewer's locale or time zone */
const longDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTH_NAMES[m! - 1]} ${y}`
}

/** the notes by month, for the index: 'October 2026' */
const MONTHS = RELEASE_NOTES.reduce<{ id: string; title: string; notes: ReleaseNote[] }[]>((months, n) => {
  const id = `m-${n.date.slice(0, 7)}`
  const last = months.at(-1)
  if (last?.id === id) last.notes.push(n)
  else months.push({ id, title: longDate(n.date).replace(/^\d+ /, ''), notes: [n] })
  return months
}, [])

const current = useCurrentSection(() => MONTHS.map((m) => m.id))

useSeoMeta(seoMeta(PAGE_HEAD['release-notes']))
</script>
