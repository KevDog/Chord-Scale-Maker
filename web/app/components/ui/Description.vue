<template>
  <p
    :id="field?.descriptionId"
    data-slot="description"
    :data-disabled="dataFlag(field?.disabled.value)"
    class="text-base/6 text-zinc-500 data-disabled:opacity-50 sm:text-sm/6 dark:text-zinc-400"
  >
    <slot />
  </p>
</template>

<script setup lang="ts">
import { FIELD } from '~/utils/field'
import { dataFlag } from '~/utils/interactive'

const field = inject(FIELD, undefined)
onMounted(() => field && field.descriptions.value++)
onUnmounted(() => field && field.descriptions.value--)
</script>
