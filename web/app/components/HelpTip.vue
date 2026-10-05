<template>
  <!-- shows on hover, and on focus so keyboard and touch users get it too; Escape hides it.
       On phones it spans the page's side margins (the icon sits next to a heading in the left gutter). -->
  <span class="group/tip relative inline-flex" @keydown.escape="dismissed = true" @pointerleave="dismissed = false" @focusout="dismissed = false">
    <button
      type="button"
      :aria-label="label"
      :aria-describedby="id"
      class="rounded-full text-zinc-500 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-zinc-400 dark:hover:text-zinc-200 dark:focus-visible:outline-sky-400"
    >
      <QuestionMarkCircleIcon class="size-5" aria-hidden="true" />
    </button>
    <span
      :id="id"
      role="tooltip"
      :class="[
        'pointer-events-none invisible absolute top-full left-0 z-20 mt-2 w-80 rounded-lg max-sm:-left-12 max-sm:w-[calc(100vw-2rem)] bg-white p-3 text-left text-sm/6 font-normal text-zinc-700 opacity-0 shadow-lg ring-1 ring-zinc-950/10 transition-opacity dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10',
        !dismissed && 'group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100',
      ]"
    >
      <slot />
    </span>
  </span>
</template>

<script setup lang="ts">
import { QuestionMarkCircleIcon } from '@heroicons/vue/16/solid'

/** a question-mark button with a short explanation as its tooltip */
defineProps<{ label: string }>()
const id = useId()
const dismissed = ref(false)
</script>
