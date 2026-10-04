<template>
  <fieldset :disabled="disabled" :data-disabled="dataFlag(disabled)" class="*:data-[slot=text]:mt-1 [&>*+[data-slot=control]]:mt-6">
    <slot />
  </fieldset>
</template>

<script setup lang="ts">
import { FIELDSET_DISABLED } from '~/utils/field'
import { dataFlag } from '~/utils/interactive'

const props = defineProps<{ disabled?: boolean }>()
provide(FIELDSET_DISABLED, toRef(() => props.disabled))
</script>
