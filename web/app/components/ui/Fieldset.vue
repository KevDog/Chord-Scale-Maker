<template>
  <fieldset :disabled="disabled" :data-disabled="dataFlag(disabled)" class="*:data-[slot=text]:mt-1 [&>*+[data-slot=control]]:mt-6">
    <slot />
  </fieldset>
</template>

<script setup lang="ts">
import { dataFlag } from '~/utils/interactive'

defineProps<{ disabled?: boolean }>()
</script>
