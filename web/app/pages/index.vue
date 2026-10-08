<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-xl">
        <!-- an album-cover style tab over the heading -->
        <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">Library</p>
        <UiHeading>Chart library</UiHeading>
        <UiText class="mt-1">Pick a tune to open it in the editor{{ myCharts ? ', or start a new chart' : '' }}. Charts are written in concert pitch.</UiText>
      </div>
      <div class="flex gap-3">
        <UiButton outline href="/contact">Request a chart</UiButton>
        <UiButton v-if="myCharts" color="note" href="/editor?new=1"><PlusIcon data-slot="icon" />New chart</UiButton>
      </div>
    </div>

    <div class="mt-8 max-w-md">
      <UiInputGroup>
        <MagnifyingGlassIcon data-slot="icon" />
        <UiInput v-model="query" type="search" placeholder="Search by title" aria-label="Search by title" />
      </UiInputGroup>
    </div>

    <ClientOnly v-if="myCharts"><MyChartsList :query="query" /></ClientOnly>
    <UiSubheading v-if="myCharts && charts.length" :level="2" class="mt-8">Library</UiSubheading>

    <UiTable v-if="charts.length" :class="[myCharts ? 'mt-3' : 'mt-6', '[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]']">
      <UiTableHead>
        <UiTableRow>
          <UiTableHeader>Title</UiTableHeader>
          <UiTableHeader>Details</UiTableHeader>
        </UiTableRow>
      </UiTableHead>
      <UiTableBody>
        <UiTableRow v-for="chart in charts" :key="chart.slug">
          <UiTableCell class="font-medium">
            <UiLink :href="`/editor?chart=${chart.slug}`" class="text-note-800 hover:underline dark:text-note-300">{{ chart.title }}</UiLink>
          </UiTableCell>
          <UiTableCell class="text-zinc-500 dark:text-zinc-400">{{ chart.subtitle }}</UiTableCell>
        </UiTableRow>
      </UiTableBody>
    </UiTable>

    <div v-else class="mt-12 text-center">
      <MusicalNoteIcon class="mx-auto size-12 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
      <UiSubheading class="mt-2" :level="2">No charts match "{{ query }}"</UiSubheading>
      <UiText class="mt-1">Try another title, or {{ myCharts ? 'start a new chart' : 'request one' }}.</UiText>
      <div v-if="myCharts" class="mt-6">
        <UiButton v-if="myCharts" color="note" href="/editor?new=1"><PlusIcon data-slot="icon" />New chart</UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/vue/16/solid'
import { MusicalNoteIcon } from '@heroicons/vue/24/outline'

const query = ref('')
const charts = computed(() => searchLibrary(LIBRARY, query.value))
const myCharts = useFeature('myCharts')
</script>
