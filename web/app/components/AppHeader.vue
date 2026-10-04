<template>
  <header class="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
    <div class="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
      <NuxtLink to="/" class="text-lg font-semibold tracking-tight">
        Chord <span class="text-accent">Scale</span> Maker
      </NuxtLink>
      <nav aria-label="Main" class="flex gap-4 text-sm">
        <NuxtLink to="/" class="hover:text-accent" active-class="text-accent">Library</NuxtLink>
        <NuxtLink to="/editor?new=1" class="hover:text-accent">New chart</NuxtLink>
      </nav>
      <button
        type="button"
        class="ml-auto rounded-md border border-zinc-300 px-3 py-1 text-sm hover:border-accent dark:border-zinc-700"
        :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`"
        @click="toggle"
      >
        {{ theme === 'dark' ? 'Light' : 'Dark' }}
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
const { theme, toggle } = useTheme()
</script>
