<template>
  <label
    data-slot="label"
    :for="field?.controlId"
    :data-disabled="dataFlag(field?.disabled.value)"
    class="text-base/6 text-zinc-950 select-none data-disabled:opacity-50 sm:text-sm/6 dark:text-white"
  >
    <slot />
  </label>
</template>

<script setup lang="ts">
import { FIELD } from '~/utils/field'
import { dataFlag } from '~/utils/interactive'

const field = inject(FIELD, undefined)
</script>
