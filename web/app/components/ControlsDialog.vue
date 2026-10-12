<template>
  <UiDialog :open="open" size="sm" @close="emit('close')">
    <UiDialogTitle>Sheet controls</UiDialogTitle>
    <UiDialogBody class="flex flex-col items-start gap-4">
      <slot />
      <!-- the actions that don't fit the phone's rail; choosing one closes the sheet -->
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
const emit = defineEmits<{ close: [] }>()
</script>
