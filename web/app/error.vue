<template>
  <AppShell>
    <div class="max-w-2xl py-8 sm:py-12">
      <p class="inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200">
        Error {{ code }}
      </p>
      <p class="mt-4 font-display text-7xl/none font-extrabold tracking-tight text-note-800 sm:text-8xl/none dark:text-note-300" aria-hidden="true">
        {{ code }}
      </p>
      <UiHeading class="mt-6">{{ copy.title }}</UiHeading>
      <UiText class="mt-2">{{ copy.text }}</UiText>
      <UiText v-if="!notFound" class="mt-2">If it keeps happening, <UiTextLink href="/contact">let me know</UiTextLink>.</UiText>
      <div class="mt-8 flex flex-wrap gap-3">
        <UiButton color="note" @click="home">Go to the chart library</UiButton>
        <UiButton v-if="!notFound" outline @click="retry">Try again</UiButton>
      </div>

      <!-- a quote from the library, at heading size, different from the one in the navbar -->
      <figure v-if="quote" class="mt-14 border-t border-zinc-950/10 pt-10 dark:border-white/10">
        <blockquote class="font-display text-2xl/9 font-semibold tracking-tight text-zinc-950 sm:text-3xl/10 dark:text-white">“{{ quote.quote }}”</blockquote>
        <figcaption class="mt-3 text-base/7 text-zinc-600 dark:text-zinc-400">— {{ quote.author }}</figcaption>
      </figure>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * our own error page, for unknown addresses and errors (Nuxt's built-in one injects an inline script the CSP rightly
 * blocks): the status, what happened in plain words, a way back, and a quote
 */
const props = defineProps<{ error: NuxtError }>()
const code = computed(() => props.error.statusCode || 500)
const notFound = computed(() => code.value === 404)
const copy = computed(() =>
  notFound.value
    ? { title: 'Page not found', text: "There's no page at this address. It may have moved, or the link may be mistyped." }
    : { title: 'Something went wrong', text: 'Something stopped this page from loading. Please try again.' },
)

const navbarQuote = useQuote()
const quote = useQuote('errorQuote', navbarQuote)

useHead({ title: computed(() => `${notFound.value ? 'Page not found' : 'Error'} · Chord Scale Maker`) })

const home = () => clearError({ redirect: '/' })
const retry = () => window.location.reload()
</script>
