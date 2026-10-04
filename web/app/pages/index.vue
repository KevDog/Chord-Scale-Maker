<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-semibold tracking-tight">Chart library</h1>
    <p class="mt-1 text-slate-600 dark:text-slate-400">
      Pick a tune to open it in the editor, or start a <NuxtLink to="/editor?new=1" class="text-accent hover:underline">new chart</NuxtLink>.
    </p>
    <label class="mt-6 block">
      <span class="sr-only">Search by title</span>
      <input
        v-model="query"
        type="search"
        placeholder="Search by title"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
      >
    </label>
    <ul class="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
      <li v-for="chart in charts" :key="chart.slug">
        <NuxtLink :to="`/editor?chart=${chart.slug}`" class="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800">
          <span class="font-medium">{{ chart.title }}</span>
          <span v-if="chart.subtitle" class="block text-sm text-slate-500 dark:text-slate-400">{{ chart.subtitle }}</span>
        </NuxtLink>
      </li>
      <li v-if="charts.length === 0" class="px-4 py-3 text-slate-500">No charts match "{{ query }}".</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const query = ref('')
const charts = computed(() => searchLibrary(LIBRARY, query.value))
</script>
