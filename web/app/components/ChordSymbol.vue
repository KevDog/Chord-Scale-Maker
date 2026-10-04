<template>
  <span class="whitespace-nowrap"><template v-for="(t, i) in tokens" :key="i"><span v-if="t.kind === 'text'">{{ t.text }}</span><sup v-else class="text-[0.75em]">{{ t.acc === 'b' ? '♭' : '♯' }}</sup></template></span>
</template>

<script setup lang="ts">
import type { ChordToken } from '~~/engine'

defineProps<{ tokens: readonly ChordToken[] }>()
</script>
