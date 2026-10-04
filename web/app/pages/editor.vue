<template>
  <ClientOnly>
    <EditorView :initial-text="initialText" />
    <template #fallback><p class="text-slate-500">Loading editor…</p></template>
  </ClientOnly>
</template>

<script setup lang="ts">
const route = useRoute()

/** library chart (?chart=slug), a blank starter (?new=1), else this browser's draft */
const initialText = computed(() => {
  const slug = typeof route.query.chart === 'string' ? route.query.chart : ''
  if (slug) return findChart(slug)?.text ?? STARTER_CHART
  if (route.query.new !== undefined) return STARTER_CHART
  return (import.meta.client && loadDraft()) || STARTER_CHART
})

useHead({ title: 'Editor · Chord Scale Maker' })
</script>
