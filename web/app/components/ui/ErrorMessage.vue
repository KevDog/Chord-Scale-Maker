<template>
  <p
    :id="field?.errorId"
    data-slot="error"
    :data-disabled="dataFlag(field?.disabled.value)"
    class="text-base/6 text-red-600 data-disabled:opacity-50 sm:text-sm/6 dark:text-red-500"
  >
    <slot />
  </p>
</template>

<script setup lang="ts">
import { FIELD } from '~/utils/field'
import { dataFlag } from '~/utils/interactive'

const field = inject(FIELD, undefined)
onMounted(() => field && (field.hasError.value = true))
onUnmounted(() => field && (field.hasError.value = false))
</script>
