<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader class="print:hidden" />
    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 print:max-w-none print:p-0">
      <NuxtPage />
    </main>
    <footer class="mx-auto w-full max-w-7xl px-4 py-6 text-sm text-slate-500 print:hidden dark:text-slate-400">
      Chord Scale Maker · charts are concert pitch ·
      <a :href="issuesUrl" class="text-accent hover:underline" rel="noopener" target="_blank">request a chart</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
const issuesUrl = useRuntimeConfig().public.issuesUrl
</script>
