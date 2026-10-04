<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
      <p class="text-sm font-medium text-accent">{{ error.statusCode }}</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">{{ notFound ? 'Page not found' : 'Something went wrong' }}</h1>
      <p class="mt-2 text-slate-600 dark:text-slate-400">
        {{ notFound ? "There's nothing at this address." : 'Please try again.' }}
      </p>
      <button type="button" class="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong dark:text-slate-950" @click="home">
        Go to the chart library
      </button>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

/** our own error page: Nuxt's built-in one injects an inline script the CSP (rightly) blocks */
const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)

useHead({ title: computed(() => `${notFound.value ? 'Page not found' : 'Error'} · Chord Scale Maker`) })

const home = () => clearError({ redirect: '/' })
</script>
