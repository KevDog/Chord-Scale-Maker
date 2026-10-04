<template>
  <a
    v-if="external"
    v-interactive
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    :class="CLASSES"
  ><slot /></a>
  <UiLink v-else :href="href" :class="CLASSES"><slot /></UiLink>
</template>

<script setup lang="ts">
import { vInteractive } from '~/utils/interactive'

/** Catalyst TextLink; `external` opens another site in a new tab */
defineProps<{ href: string; external?: boolean }>()
const CLASSES =
  'text-zinc-950 underline decoration-zinc-950/50 data-hover:decoration-zinc-950 dark:text-white dark:decoration-white/50 dark:data-hover:decoration-white'
</script>
