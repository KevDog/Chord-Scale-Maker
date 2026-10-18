<template>
  <!-- a tune with more than one library chart: pick which version the sheets show (#411) -->
  <div v-if="choices.length" class="mb-4 flex items-center gap-3 print:hidden">
    <UiText class="shrink-0" aria-hidden="true">Version</UiText>
    <UiListbox :model-value="current" class="w-64" aria-label="Version" @update:model-value="(p) => p && p !== current && navigateTo(p)">
      <template #selected="{ value }"><UiListboxLabel>{{ labelOf(value) }}</UiListboxLabel></template>
      <UiListboxOption v-for="c in choices" :key="c.path" :value="c.path"><UiListboxLabel>{{ c.label }}</UiListboxLabel></UiListboxOption>
    </UiListbox>
  </div>
</template>

<script setup lang="ts">
import { songPath } from '~/utils/site'
import { versionChoices } from '~/utils/songVersions'

const props = defineProps<{ slug: string }>()
const choices = computed(() => versionChoices(props.slug))
const current = computed(() => songPath(props.slug))
const labelOf = (path: string): string => choices.value.find((c) => c.path === path)?.label ?? ''
</script>
