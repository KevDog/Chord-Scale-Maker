<template>
  <figure class="space-y-2">
    <div class="relative aspect-video overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-zinc-950/10 dark:ring-white/10">
      <iframe
        v-if="playing"
        class="absolute inset-0 size-full"
        :src="`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`"
        :title="title"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      />
      <button
        v-else
        type="button"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white"
        @click="playing = true"
      >
        <span class="flex size-16 items-center justify-center rounded-full bg-note-500" aria-hidden="true">
          <PlayIcon class="size-8 translate-x-0.5" />
        </span>
        <span class="font-display text-lg/6 font-semibold">{{ title }}</span>
        <span class="text-sm text-zinc-300">Play the video (loads YouTube)</span>
      </button>
    </div>
    <figcaption class="text-sm text-zinc-500 dark:text-zinc-400"><slot /></figcaption>
  </figure>
</template>

<script setup lang="ts">
import { PlayIcon } from '@heroicons/vue/24/solid'

/**
 * a YouTube video that loads only when played: until then nothing is fetched from YouTube. It then plays from
 * YouTube's privacy-enhanced domain, the only frame source the CSP allows (build/csp.ts).
 */
defineProps<{ id: string; title: string }>()
const playing = ref(false)
</script>
