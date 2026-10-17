<template>
  <template v-for="(p, i) in parts" :key="i">
    <template v-if="p.path">
      <UiLink :href="p.path" class="underline decoration-current/30 underline-offset-2 hover:text-zinc-950 hover:decoration-current dark:hover:text-white print:hidden">{{ p.text }}</UiLink>
      <span class="hidden print:inline">{{ p.text }}</span>
    </template>
    <template v-else>{{ p.text }}</template>
  </template>
</template>

<script setup lang="ts">
import { type CreditPart, creditParts } from '~/utils/composerPage'

/** a composer: credit as written (or already in parts), each library composer linked to their page on screen (plain
 * in print) */
const props = defineProps<{ credit?: string; parts?: readonly CreditPart[] }>()
const parts = computed(() => props.parts ?? creditParts(props.credit ?? ''))
</script>
