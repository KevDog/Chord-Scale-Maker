<template>
  <section aria-labelledby="totd-heading">
    <div class="flex items-baseline justify-between gap-4">
      <h2 id="totd-heading" class="text-xs/4 font-medium text-zinc-500 dark:text-zinc-400">Tune of the day</h2>
      <button v-if="tune" type="button" aria-label="Another tune" class="rounded-sm text-xs/4 font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-note-500 dark:focus-visible:outline-note-300" @click="another">Another →</button>
    </div>
    <!-- picked by the viewer's date, so in the browser (the page is prerendered); the same size until then -->
    <div class="group relative mt-3 min-h-[8.5rem] rounded-paper bg-paper p-5 shadow-paper">
      <template v-if="tune">
        <div class="grid grid-cols-[1fr_auto] items-start gap-4">
          <div class="min-w-0">
            <a :href="songPath(tune.slug)" class="font-display text-2xl/[30px] font-bold text-balance text-zinc-900 group-hover:text-accent after:absolute after:inset-0 dark:text-white">{{ tune.title }}</a>
            <p class="mt-1 text-[13px]/5 text-zinc-500 dark:text-zinc-400">{{ tune.composer }}</p>
          </div>
          <p v-if="tune.key" class="text-right">
            <span class="block font-display text-[28px]/none font-semibold text-zinc-900 tabular-nums dark:text-white" aria-hidden="true">{{ keyName(written(tune.key)) }}</span>
            <span v-if="transposing" class="mt-1 block text-[11px]/[14px] whitespace-nowrap text-zinc-500 dark:text-zinc-400" aria-hidden="true">concert {{ keyName(tune.key) }}</span>
            <span class="sr-only">in {{ keyName(written(tune.key)) }}{{ transposing ? `, concert ${keyName(tune.key)}` : '' }}</span>
          </p>
        </div>
        <p v-if="details" class="mt-4 border-t border-zinc-950/5 pt-3 text-xs text-zinc-500 dark:border-white/5 dark:text-zinc-400">{{ details }}</p>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { INSTRUMENTS, writtenKey } from '@chord-scale-maker/engine'
import { keyName, type LibraryChart, TUNES } from '~/utils/library'
import { songPath } from '~/utils/site'
import { anotherTune, tuneOfTheDay } from '~/utils/tuneOfTheDay'

/** the home page's tune of the day (issue #249), its key written for this browser's instrument */
const tune = ref<LibraryChart | null>(null)
const { instrument } = usePreferences()
const transposing = computed(() => INSTRUMENTS[instrument.value].trans !== 'C')
const written = (key: string): string => writtenKey(key, INSTRUMENTS[instrument.value])
const details = computed(() => (tune.value ? [tune.value.style, tune.value.form].filter(Boolean).join(' · ') : ''))

onMounted(() => (tune.value = tuneOfTheDay(TUNES, new Date())))
function another(): void {
  if (tune.value) tune.value = anotherTune(TUNES, tune.value, Math.random()) ?? tune.value
}
</script>
