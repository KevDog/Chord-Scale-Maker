<template>
  <!-- a tune with more than one chart, the library's and yours: pick which version the sheets show (#411) -->
  <!-- a rail group (#427), labelled as the others are; on a phone, label hidden, beside the actions so it costs no row (phone.spec.ts) -->
  <UiField v-if="all.length" class="print:hidden">
    <!-- names the button with its value ("Version Ballad"): hidden, on a phone or aria-hidden, it is still read so (#425) -->
    <UiLabel :id="labelId" class="pl-3 max-sm:hidden" aria-hidden="true">Version</UiLabel>
    <div class="flex items-center gap-2">
      <UiListbox :model-value="current" class="w-36 sm:w-52" :labelled-by="labelId" @update:model-value="(p) => p && p !== current && navigateTo(p)">
        <template #selected="{ value }"><UiListboxLabel>{{ labelOf(value) }}</UiListboxLabel></template>
        <!-- the library's versions are a group too once yours are, else a flat list -->
        <template v-if="!choices.mine.length">
          <UiListboxOption v-for="c in choices.library" :key="c.path" :value="c.path"><UiListboxLabel>{{ c.label }}</UiListboxLabel></UiListboxOption>
        </template>
        <UiListboxGroup v-else label="Library">
          <UiListboxOption v-for="c in choices.library" :key="c.path" :value="c.path"><UiListboxLabel>{{ c.label }}</UiListboxLabel></UiListboxOption>
        </UiListboxGroup>
        <UiListboxGroup v-if="choices.mine.length" label="Mine">
          <UiListboxOption v-for="c in choices.mine" :key="c.path" :value="c.path"><UiListboxLabel>{{ c.label }}</UiListboxLabel></UiListboxOption>
        </UiListboxGroup>
      </UiListbox>
    </div>
  </UiField>
</template>

<script setup lang="ts">
import { chartText, listCharts, savedRevision } from '~/utils/myCharts'
import { songPath } from '~/utils/site'
import { type ChartAt, ofTune, savedVersion, tuneAt, versionChoices } from '~/utils/songVersions'

const props = defineProps<{ at: ChartAt }>()
const labelId = useId()

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
