<template>
  <span class="inline-flex items-center gap-1 align-middle text-zinc-700 dark:text-zinc-300 print:text-black">
    <svg v-if="segno" viewBox="0 0 16 16" class="h-4 w-4" aria-label="Segno" role="img">
      <path d="M11 3c-3 0-4 2-4 3.5C7 8 8.5 9 10 10s3 2 3 3.5C13 15 11.5 16 10 16" fill="none" stroke="currentColor" stroke-width="1.4" />
      <line x1="4" y1="2" x2="12" y2="14" stroke="currentColor" stroke-width="1.4" />
      <circle cx="4.5" cy="4" r="1" fill="currentColor" />
      <circle cx="11.5" cy="12" r="1" fill="currentColor" />
    </svg>
    <svg v-if="coda" viewBox="0 0 16 16" class="h-4 w-4" aria-label="Coda" role="img">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />
      <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" stroke-width="1.4" />
      <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.4" />
    </svg>
    <span v-if="nav" class="text-xs font-semibold whitespace-nowrap italic">{{ nav }}</span>
  </span>
</template>

<script setup lang="ts">
/** the navigation marks above a Changes bar: a segno 𝄋, a coda ⊕ (both inline SVG, CSP-safe), and an instruction */
defineProps<{ segno: boolean; coda: boolean; nav: string }>()
</script>
