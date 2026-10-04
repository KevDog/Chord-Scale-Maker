<template>
  <div
    :data-disabled="dataFlag(disabled)"
    class="[&>[data-slot=label]+[data-slot=control]]:mt-3 [&>[data-slot=label]+[data-slot=description]]:mt-1 [&>[data-slot=description]+[data-slot=control]]:mt-3 [&>[data-slot=control]+[data-slot=description]]:mt-3 [&>[data-slot=control]+[data-slot=error]]:mt-3 *:data-[slot=label]:font-medium"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { FIELD, FIELDSET_DISABLED } from '~/utils/field'
import { dataFlag } from '~/utils/interactive'

/** Catalyst Field: wires its Label, Description and ErrorMessage to the control inside it */
const props = defineProps<{ disabled?: boolean }>()
const fieldsetDisabled = inject(FIELDSET_DISABLED, undefined)
const disabled = computed(() => props.disabled || !!fieldsetDisabled?.value)
const id = useId()
provide(FIELD, {
  controlId: `${id}-control`,
  descriptionId: `${id}-description`,
  errorId: `${id}-error`,
  descriptions: ref(0),
  errors: ref(0),
  disabled,
})
</script>
