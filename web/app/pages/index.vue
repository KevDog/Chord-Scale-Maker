<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-semibold tracking-tight">Chart library</h1>
    <p class="mt-1 text-zinc-600 dark:text-zinc-400">
      Pick a tune to open it in the editor, or start a <NuxtLink to="/editor?new=1" class="text-accent hover:underline">new chart</NuxtLink>.
    </p>
    <label class="mt-6 block">
      <span class="sr-only">Search by title</span>
      <input
        v-model="query"
        type="search"
        placeholder="Search by title"
        class="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
    </label>
    <ul class="mt-4 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      <li v-for="chart in charts" :key="chart.slug">
        <NuxtLink :to="`/editor?chart=${chart.slug}`" class="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
          <span class="font-medium">{{ chart.title }}</span>
          <span v-if="chart.subtitle" class="block text-sm text-zinc-500 dark:text-zinc-400">{{ chart.subtitle }}</span>
        </NuxtLink>
      </li>
      <li v-if="charts.length === 0" class="px-4 py-3 text-zinc-500">No charts match "{{ query }}".</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const query = ref('')
const charts = computed(() => searchLibrary(LIBRARY, query.value))
</script>
