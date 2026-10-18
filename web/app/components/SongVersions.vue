<template>
  <!-- a tune with more than one chart, the library's and yours: pick which version the sheets show (#411) -->
  <div v-if="all.length" class="mb-4 flex items-center gap-3 print:hidden">
    <UiText class="shrink-0" aria-hidden="true">Version</UiText>
    <UiListbox :model-value="current" class="w-64" aria-label="Version" @update:model-value="(p) => p && p !== current && navigateTo(p)">
      <template #selected="{ value }"><UiListboxLabel>{{ labelOf(value) }}</UiListboxLabel></template>
      <UiListboxOption v-for="c in choices.library" :key="c.path" :value="c.path"><UiListboxLabel>{{ c.label }}</UiListboxLabel></UiListboxOption>
      <UiListboxGroup v-if="choices.mine.length" label="Mine">
        <UiListboxOption v-for="c in choices.mine" :key="c.path" :value="c.path"><UiListboxLabel>{{ c.label }}</UiListboxLabel></UiListboxOption>
      </UiListboxGroup>
    </UiListbox>
  </div>
</template>

<script setup lang="ts">
import { tuneNamed } from '~/utils/library'
import { listCharts, loadChart } from '~/utils/myCharts'
import { songPath } from '~/utils/site'
import { type ChartAt, savedVersion, type SavedVersion, versionChoices } from '~/utils/songVersions'

const props = defineProps<{ at: ChartAt }>()

/** your saved charts that could be a library tune's: only these are read in full, for their version: line */
function savedOfLibrary(): SavedVersion[] {
  return listCharts()
    .filter((m) => m.kind !== 'edited' && (m.basedOn || tuneNamed(m.title)))
    .flatMap((m) => {
      const c = loadChart(m.id)
      return c ? [savedVersion(c)] : []
    })
}

const choices = computed(() => versionChoices(props.at, savedOfLibrary()))
const all = computed(() => [...choices.value.library, ...choices.value.mine])
const current = computed(() => ('slug' in props.at ? songPath(props.at.slug) : `/song?mine=${props.at.mine.id}`))
const labelOf = (path: string): string => all.value.find((c) => c.path === path)?.label ?? ''
</script>
