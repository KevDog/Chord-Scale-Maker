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
import { chartText, listCharts, savedRevision } from '~/utils/myCharts'
import { songPath } from '~/utils/site'
import { type ChartAt, ofTune, savedVersion, tuneAt, versionChoices } from '~/utils/songVersions'

const props = defineProps<{ at: ChartAt }>()

// the tune first, then only its saved charts' texts are read (for their version: lines); a save or delete re-reads
const choices = computed(() => {
  void savedRevision.value
  const tune = tuneAt(props.at)
  const mine = tune ? listCharts().filter((m) => ofTune(tune, m)) : []
  return versionChoices(tune, mine.flatMap((m) => {
    const text = chartText(m.id)
    return text === null ? [] : [savedVersion(m, text)]
  }))
})
const all = computed(() => [...choices.value.library, ...choices.value.mine])
const current = computed(() => ('slug' in props.at ? songPath(props.at.slug) : `/song?mine=${props.at.mine.id}`))
const labelOf = (path: string): string => all.value.find((c) => c.path === path)?.label ?? ''
</script>
