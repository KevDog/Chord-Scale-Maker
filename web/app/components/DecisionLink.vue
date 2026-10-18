<template>
  <UiTextLink :href="decision.href" :title="decision.summary"><slot>How this is chosen</slot></UiTextLink>
</template>

<script setup lang="ts">
import { decisionOf, type DecisionId } from '@chord-scale-maker/engine'

/** a link to where the docs explain a choice the app made (engine/src/decisions.ts), its summary as the title */
const props = defineProps<{ id: DecisionId }>()
const decision = computed(() => decisionOf(props.id))
</script>
