<template>
  <div @dragover="onDragOver" @drop="onDrop">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-xl">
        <UiHeading>Library</UiHeading>
        <UiText class="mt-1">Pick a tune to open its practice sheets{{ myCharts ? ', or start a new chart' : '' }}. Charts are written in concert pitch.</UiText>
      </div>
      <div class="flex flex-wrap gap-3">
        <UiButton outline href="/contact">Request a chart</UiButton>
        <template v-if="myCharts">
          <UiButton outline :disabled="opener.busy.value" title="Open a chart saved as a .txt file (or drop one on this page)" @click="fileInput?.click()"><FolderOpenIcon data-slot="icon" />Open chart…</UiButton>
          <UiButton color="note" href="/song?new=1" class="max-md:hidden"><PlusIcon data-slot="icon" />New chart</UiButton>
        </template>
      </div>
    </div>
    <input v-if="myCharts" ref="fileInput" type="file" accept=".txt,text/plain" class="sr-only" tabindex="-1" aria-hidden="true" @change="pick">
    <UiText v-if="opener.error.value" role="alert" class="mt-3 text-red-700! dark:text-red-400!">{{ opener.error.value }}</UiText>

    <div class="mt-8 max-w-md">
      <UiInputGroup>
        <MagnifyingGlassIcon data-slot="icon" />
        <UiInput v-model="query" type="search" placeholder="Search by title or composer" aria-label="Search by title or composer" />
      </UiInputGroup>
    </div>

    <ClientOnly v-if="myCharts"><MyChartsList :query="query" @count="mine = $event" /></ClientOnly>
    <!-- "Library" again only to set it apart from My charts above it -->
    <UiSubheading v-if="mine && charts.length" :level="2" class="mt-8">Library</UiSubheading>

    <!-- A–Z: each letter with tunes jumps to its first; hidden while searching -->
    <nav v-if="!query.trim() && charts.length" aria-label="Jump to letter" :class="[mine ? 'mt-3' : 'mt-6', 'flex flex-wrap gap-1']">
      <a
        v-for="l in letters"
        :key="l.letter"
        :href="`#letter-${l.letter}`"
        class="grid size-8 place-items-center rounded-control text-sm/6 font-semibold text-note-800 hover:bg-note-100 focus-visible:outline-2 focus-visible:outline-accent dark:text-note-300 dark:hover:bg-white/10"
        @click.prevent="jump(l.letter)"
      >{{ l.letter }}</a>
    </nav>

    <!-- phones: a list, one tune a row, nothing off screen sideways -->
    <ul v-if="charts.length" class="mt-4 divide-y divide-zinc-950/5 sm:hidden dark:divide-white/5">
      <li v-for="chart in charts" :key="chart.slug" :data-letter="firstOf[chart.slug]" class="relative scroll-mt-4 py-3">
        <!-- the whole row is the link's tap target -->
        <UiLink :href="songPath(chart.slug)" class="text-[15px]/6 font-semibold text-note-800 after:absolute after:inset-0 dark:text-note-300">{{ chart.title }}</UiLink>
        <p class="truncate text-sm/5 text-zinc-500 dark:text-zinc-400">{{ [chart.composer, chart.details].filter(Boolean).join(' · ') }}</p>
      </li>
    </ul>

    <UiTable v-if="charts.length" :class="['mt-4 max-sm:hidden', '[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]']">
      <UiTableHead>
        <UiTableRow>
          <UiTableHeader>Title</UiTableHeader>
          <UiTableHeader>Composer</UiTableHeader>
          <UiTableHeader>Details</UiTableHeader>
        </UiTableRow>
      </UiTableHead>
      <UiTableBody>
        <UiTableRow v-for="chart in charts" :id="firstOf[chart.slug] && `letter-${firstOf[chart.slug]}`" :key="chart.slug" :data-letter="firstOf[chart.slug]" class="scroll-mt-4">
          <UiTableCell class="font-medium">
            <UiLink :href="songPath(chart.slug)" class="text-note-800 hover:underline dark:text-note-300">{{ chart.title }}</UiLink>
          </UiTableCell>
          <UiTableCell class="text-zinc-500 dark:text-zinc-400">{{ chart.composer }}</UiTableCell>
          <UiTableCell class="text-zinc-500 dark:text-zinc-400">{{ chart.details }}</UiTableCell>
        </UiTableRow>
      </UiTableBody>
    </UiTable>

    <div v-else class="mt-12 text-center">
      <MusicalNoteIcon class="mx-auto size-12 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
      <UiSubheading class="mt-2" :level="2">No charts match "{{ query }}"</UiSubheading>
      <UiText class="mt-1">Try another title or composer, or {{ myCharts ? 'start a new chart' : 'request one' }}.</UiText>
      <div v-if="myCharts" class="mt-6">
        <UiButton v-if="myCharts" outline href="/song?new=1" class="max-md:hidden"><PlusIcon data-slot="icon" />New chart</UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta, songPath } from '~/utils/site'
import { letterIndex } from '~/utils/libraryIndex'
import { jsonLd, webAppLd, websiteLd } from '~/utils/structuredData'
import { FolderOpenIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/vue/16/solid'
import { MusicalNoteIcon } from '@heroicons/vue/24/outline'

useSeoMeta(seoMeta(PAGE_HEAD.index))
useHead({ script: [{ type: 'application/ld+json', innerHTML: jsonLd([websiteLd(), webAppLd()]) }] })

const query = ref('')
const charts = computed(() => searchLibrary(LIBRARY, query.value))
const myCharts = useFeature('myCharts')
/** how many of My charts show above the library (0: none, so no second "Library") */
const mine = ref(0)
const letters = letterIndex(LIBRARY)
/** the first tune of each letter (slug → letter), the A–Z bar's targets */
const firstOf: Readonly<Record<string, string>> = Object.fromEntries(letters.map((l) => [l.slug, l.letter]))
/** to a letter's first tune, in whichever of the table or the list is showing */
function jump(letter: string): void {
  const target = [...document.querySelectorAll<HTMLElement>(`[data-letter="${letter}"]`)].find((e) => e.offsetParent !== null)
  target?.scrollIntoView({ block: 'start' })
  target?.querySelector('a')?.focus({ preventScroll: true }) // the keyboard goes on from the tune, not the next letter
  history.replaceState(history.state, '', `#letter-${letter}`)
}
// arriving at /#letter-R (a reload, a link): the ids are on the table's rows, hidden on a phone
onMounted(() => {
  const letter = /^#letter-(.)$/.exec(location.hash)?.[1]
  if (letter) nextTick(() => jump(letter))
})
const opener = useOpenChart()
const fileInput = ref<HTMLInputElement | null>(null)

function pick(e: Event): void {
  const input = e.target as HTMLInputElement
  void opener.open(input.files?.[0])
  input.value = '' // the same file again still fires change
}
/** with My charts, a chart file dropped anywhere on the page opens it */
const hasFile = (e: DragEvent): boolean => myCharts && (e.dataTransfer?.types.includes('Files') ?? false)
function onDragOver(e: DragEvent): void {
  if (hasFile(e)) e.preventDefault() // allow the drop
}
function onDrop(e: DragEvent): void {
  if (!hasFile(e)) return
  e.preventDefault()
  void opener.open(e.dataTransfer?.files[0])
}
</script>
