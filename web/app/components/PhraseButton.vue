<template>
  <!-- a staff's Play (#507): its phrase at the click's tempo; on the song page only (a page with a click), on screen only; inline, so a staff keeps its height -->
  <button
    v-if="click && on"
    type="button"
    data-slot="phrase-play"
    :aria-label="sounding ? `Stop ${label}` : `Play ${label}`"
    :title="sounding ? 'Stop' : 'Play at the click’s tempo'"
    class="hit-target inline-flex cursor-pointer items-center justify-center rounded-sm align-middle text-zinc-500 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500 dark:text-zinc-400 dark:hover:text-white print:hidden"
    @click="press"
  >
    <StopIcon v-if="sounding" class="size-4" aria-hidden="true" /><PlayIcon v-else class="size-4" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import type { PhraseNote } from '@chord-scale-maker/engine'
import { PlayIcon, StopIcon } from '@heroicons/vue/16/solid'
import { CLICK } from '~/composables/useClick'

/** id: unique on the sheet (the staff's); label: what it plays, for the aria-label; phrase: made when pressed */
const props = defineProps<{ id: string; label: string; phrase: () => readonly PhraseNote[] }>()

const click = inject(CLICK, null)
const on = useFeature('hearLine')
const sounding = computed(() => click?.playing.value === props.id)

function press(): void {
  if (!click) return
  if (sounding.value) click.stopPhrase()
  else void click.play(props.id, props.phrase())
}
</script>
