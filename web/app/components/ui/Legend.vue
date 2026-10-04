<template>
  <legend data-slot="legend" :data-disabled="dataFlag(disabled)" class="text-base/6 font-semibold text-zinc-950 data-disabled:opacity-50 sm:text-sm/6 dark:text-white">
    <slot />
  </legend>
</template>

<script setup lang="ts">
import { FIELDSET_DISABLED } from '~/utils/field'
import { dataFlag } from '~/utils/interactive'

const disabled = inject(FIELDSET_DISABLED, undefined)
</script>
