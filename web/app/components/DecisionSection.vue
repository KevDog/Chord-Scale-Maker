<template>
  <section class="scroll-mt-6 space-y-4" :aria-labelledby="id" :data-decision="id">
    <UiSubheading :id="id" :level="level" class="scroll-mt-6">{{ title }}</UiSubheading>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { DECISIONS } from '@chord-scale-maker/engine'

/** one section of How it decides, headed with its decision's title (engine/src/decisions.ts); its id is the anchor.
 *  An id the registry doesn't name shows as itself, and the anchor test warns of it. */
const props = withDefaults(defineProps<{ id: string; level?: 2 | 3 }>(), { level: 3 })
const title = computed(() => DECISIONS.find((d) => d.id === props.id)?.title ?? props.id)
</script>
