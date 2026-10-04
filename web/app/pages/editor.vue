<template>
  <ClientOnly>
    <!-- keyed by URL: "New chart" or another library chart must start a fresh editor -->
    <EditorView :key="route.fullPath" :initial-text="initialText" />
    <template #fallback><p class="text-zinc-500">Loading editor…</p></template>
  </ClientOnly>
</template>

<script setup lang="ts">
const route = useRoute()
const newChart = useFeature('newChart')
const slug = computed(() => (typeof route.query.chart === 'string' ? route.query.chart : ''))

// without the newChart feature the editor only opens library charts (not on the prerender, which has no query)
if (import.meta.client && !newChart && !findChart(slug.value)) await navigateTo('/', { replace: true })

/** library chart (?chart=slug), a blank starter (?new=1), else this browser's draft */
const initialText = computed(() => {
  if (slug.value) return findChart(slug.value)?.text ?? STARTER_CHART
  if (route.query.new !== undefined) return STARTER_CHART
  return (import.meta.client && loadDraft()) || STARTER_CHART
})

useHead({ title: 'Editor · Chord Scale Maker' })
</script>
