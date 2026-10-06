<template>
  <AppShell>
    <div class="mx-auto max-w-xl py-16 text-center">
      <p class="text-sm font-semibold text-accent">{{ error.statusCode }}</p>
      <UiHeading class="mt-2">{{ notFound ? 'Page not found' : 'Something went wrong' }}</UiHeading>
      <UiText class="mt-2">{{ notFound ? "There's nothing at this address." : 'Please try again.' }}</UiText>
      <div class="mt-6">
        <UiButton color="note" @click="home">Go to the chart library</UiButton>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

/** our own error page: Nuxt's built-in one injects an inline script the CSP (rightly) blocks */
const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)

useHead({ title: computed(() => `${notFound.value ? 'Page not found' : 'Error'} · Chord Scale Maker`) })

const home = () => clearError({ redirect: '/' })
</script>
