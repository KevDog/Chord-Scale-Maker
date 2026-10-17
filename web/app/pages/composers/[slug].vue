<template>
  <div v-if="page" class="max-w-4xl">
    <header>
      <p class="mb-2"><NuxtLink :to="COMPOSERS_PATH" class="text-sm/6 font-medium text-accent hover:underline">Composers</NuxtLink></p>
      <UiHeading>{{ page.name }}</UiHeading>
      <UiText class="mt-1">{{ count }} in the library. Open one for its chord changes, with the scales, guide tones and arpeggios written for your instrument.</UiText>
    </header>

    <!-- phones: a list, one tune a row, as the library shows it (the row is the tune's link: co-writers as text) -->
    <ul class="mt-8 divide-y divide-zinc-950/5 sm:hidden dark:divide-white/5">
      <li v-for="t in page.tunes" :key="t.path" class="relative py-3">
        <UiLink :href="t.path" class="text-[15px]/6 font-semibold text-note-800 after:absolute after:inset-0 dark:text-note-300">{{ t.title }}</UiLink>
        <p class="truncate text-sm/5 text-zinc-500 dark:text-zinc-400">
          <template v-if="t.with.length">with {{ t.with.map((w) => w.text).join('') }} · </template>{{ t.details }}
        </p>
      </li>
    </ul>

    <UiTable class="mt-8 max-sm:hidden [--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
      <UiTableHead>
        <UiTableRow>
          <UiTableHeader>Title</UiTableHeader>
          <UiTableHeader v-if="cowritten">With</UiTableHeader>
          <UiTableHeader>Details</UiTableHeader>
        </UiTableRow>
      </UiTableHead>
      <UiTableBody>
        <UiTableRow v-for="t in page.tunes" :key="t.path">
          <UiTableCell class="font-medium">
            <UiLink :href="t.path" class="text-note-800 hover:underline dark:text-note-300">{{ t.title }}</UiLink>
          </UiTableCell>
          <UiTableCell v-if="cowritten" class="text-zinc-500 dark:text-zinc-400"><ComposerCredit :parts="t.with" /></UiTableCell>
          <UiTableCell class="text-zinc-500 dark:text-zinc-400">{{ t.details }}</UiTableCell>
        </UiTableRow>
      </UiTableBody>
    </UiTable>
  </div>
</template>

<script setup lang="ts">
import { COMPOSERS_PATH, composerHead, composerPage } from '~/utils/composerPage'
import { seoMeta } from '~/utils/site'

/** a composer's page (/composers/<slug>): their library tunes, each with whoever wrote it with them */
const route = useRoute()
const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
const page = composerPage(slug)
const head = composerHead(slug)
if (!page || !head) throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
useSeoMeta(seoMeta(head.head))
useHead({ script: [{ type: 'application/ld+json', innerHTML: head.ld }] })

const count = `${page.tunes.length} ${page.tunes.length === 1 ? 'tune' : 'tunes'}`
const cowritten = page.tunes.some((t) => t.with.length)
</script>
