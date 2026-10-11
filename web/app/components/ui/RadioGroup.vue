<template>
  <HRadioGroup v-model="model" data-slot="control" :class="['space-y-1', '**:data-[slot=label]:font-normal']">
    <slot />
  </HRadioGroup>
</template>

<script setup lang="ts" generic="T extends string">
import { RadioGroup as HRadioGroup } from '@headlessui/vue'

/** Catalyst RadioGroup on @headlessui/vue: UiRadio children; name it with aria-label or aria-labelledby */
const model = defineModel<T>()
</script>
