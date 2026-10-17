<template>
  <div class="max-w-4xl">
    <header class="max-w-xl">
      <UiHeading>Composers</UiHeading>
      <UiText class="mt-1">Everyone who wrote a tune in the library, by surname, with a page of their tunes.</UiText>
    </header>

    <nav aria-label="Jump to letter" class="mt-6 flex flex-wrap gap-1">
      <a
        v-for="g in GROUPS"
        :key="g.letter"
        :href="`#letter-${g.letter}`"
        class="grid size-8 place-items-center rounded-control text-sm/6 font-semibold text-note-800 hover:bg-note-100 focus-visible:outline-2 focus-visible:outline-accent dark:text-note-300 dark:hover:bg-white/10"
      >{{ g.letter }}</a>
    </nav>

    <section v-for="g in GROUPS" :id="`letter-${g.letter}`" :key="g.letter" :aria-labelledby="`heading-${g.letter}`" class="mt-8 scroll-mt-6">
      <UiSubheading :id="`heading-${g.letter}`" :level="2" class="border-b border-zinc-950/10 pb-1 dark:border-white/10">{{ g.letter }}</UiSubheading>
      <ul class="mt-2 gap-x-8 sm:columns-2 lg:columns-3">
        <li v-for="c in g.composers" :key="c.slug" class="flex break-inside-avoid items-baseline justify-between gap-3 py-1 text-sm/6">
          <UiTextLink :href="composerPath(c.slug)">{{ c.name }}</UiTextLink>
          <span class="text-zinc-500 tabular-nums dark:text-zinc-400">{{ c.tunes.length }}<span class="sr-only">{{ c.tunes.length === 1 ? ' tune' : ' tunes' }}</span></span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { COMPOSERS, composerPath } from '~/utils/composerPage'
import { letterOf } from '~/utils/libraryIndex'
import { PAGE_HEAD, seoMeta } from '~/utils/site'

/** /composers: every library composer, filed by surname under its letter, each linking to their page */
const GROUPS = COMPOSERS.reduce<{ letter: string; composers: (typeof COMPOSERS)[number][] }[]>((groups, c) => {
  const letter = letterOf(c.sortKey)
  if (groups.at(-1)?.letter === letter) groups.at(-1)?.composers.push(c)
  else groups.push({ letter, composers: [c] })
  return groups
}, [])

useSeoMeta(seoMeta(PAGE_HEAD.composers))
</script>
