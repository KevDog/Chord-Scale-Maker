<template>
  <UiDialog :open="open" size="sm" @close="emit('close')" @closed="emit('closed')">
    <UiDialogTitle>Controls</UiDialogTitle>
    <UiDialogBody class="flex flex-col items-start gap-4">
      <slot />
      <!-- the actions that don't fit the phone's rail; choosing one closes the sheet (and runs once it has closed, so
           focus lands where the action puts it, not back on Controls) -->
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -- delegation: the buttons inside take the keys -->
      <div v-if="$slots.actions" class="flex flex-wrap gap-2 border-t border-zinc-950/10 pt-4 dark:border-white/10" @click="emit('close')">
        <slot name="actions" />
      </div>
    </UiDialogBody>
    <UiDialogActions>
      <UiButton color="note" @click="emit('close')">Close</UiButton>
    </UiDialogActions>
  </UiDialog>
</template>

<script setup lang="ts">
/** phones (compactRail): the rail's other controls in a dialog, the same components bound to the same values */
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; closed: [] }>()
</script>
