<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-xl">
        <UiHeading>Chart library</UiHeading>
        <UiText class="mt-1">Pick a tune to open it in the editor{{ newChart ? ', or start a new chart' : '' }}. Charts are written in concert pitch.</UiText>
      </div>
      <div class="flex gap-3">
        <UiButton outline :href="requestUrl" target="_blank" rel="noopener noreferrer">Request a chart</UiButton>
        <UiButton v-if="newChart" color="teal" href="/editor?new=1"><PlusIcon data-slot="icon" />New chart</UiButton>
      </div>
    </div>

    <div class="mt-8 max-w-md">
      <UiInputGroup>
        <MagnifyingGlassIcon data-slot="icon" />
        <UiInput v-model="query" type="search" placeholder="Search by title" aria-label="Search by title" />
      </UiInputGroup>
    </div>

    <UiTable v-if="charts.length" class="mt-6 [--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
      <UiTableHead>
        <UiTableRow>
          <UiTableHeader>Title</UiTableHeader>
          <UiTableHeader>Details</UiTableHeader>
        </UiTableRow>
      </UiTableHead>
      <UiTableBody>
        <UiTableRow v-for="chart in charts" :key="chart.slug">
          <UiTableCell class="font-medium">
            <UiLink :href="`/editor?chart=${chart.slug}`" class="hover:underline">{{ chart.title }}</UiLink>
          </UiTableCell>
          <UiTableCell class="text-zinc-500 dark:text-zinc-400">{{ chart.subtitle }}</UiTableCell>
        </UiTableRow>
      </UiTableBody>
    </UiTable>

    <div v-else class="mt-12 text-center">
      <MusicalNoteIcon class="mx-auto size-12 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
      <UiSubheading class="mt-2" :level="2">No charts match "{{ query }}"</UiSubheading>
      <UiText class="mt-1">Try another title, or {{ newChart ? 'start a new chart' : 'request one' }}.</UiText>
      <div v-if="newChart" class="mt-6">
        <UiButton v-if="newChart" color="teal" href="/editor?new=1"><PlusIcon data-slot="icon" />New chart</UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/vue/16/solid'
import { MusicalNoteIcon } from '@heroicons/vue/24/outline'

const query = ref('')
const charts = computed(() => searchLibrary(LIBRARY, query.value))
/** a new GitHub issue with the "Add Chart" label (applied for users who may label issues) */
const requestUrl = `${useRuntimeConfig().public.issuesUrl}?${new URLSearchParams({ labels: 'Add Chart' })}`
const newChart = useFeature('newChart')
</script>
