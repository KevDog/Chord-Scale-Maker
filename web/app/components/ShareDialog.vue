<template>
  <UiDialog :open="open" size="lg" @close="emit('close')">
    <UiDialogTitle>Share this chart</UiDialogTitle>
    <UiDialogDescription>
      The whole chart, its scale choices and how you're viewing it are inside the link itself; nothing is uploaded.
      Anyone with the link can open it, on any device.
    </UiDialogDescription>
    <UiDialogBody>
      <UiField>
        <UiLabel>Link</UiLabel>
        <UiInput :model-value="link ?? 'Making the link…'" readonly @focus="($event.target as HTMLInputElement).select()" />
        <UiDescription v-if="link && link.length > LONG_LINK">This link is long ({{ link.length.toLocaleString() }} characters); some apps cut long links short. Downloading the chart is the sure way.</UiDescription>
      </UiField>
    </UiDialogBody>
    <UiDialogActions>
      <UiText v-if="copied" role="status" class="mr-auto">Copied.</UiText>
      <UiButton plain @click="emit('close')">Close</UiButton>
      <UiButton color="note" :disabled="!link" @click="copy"><ClipboardDocumentIcon data-slot="icon" />Copy link</UiButton>
    </UiDialogActions>
  </UiDialog>
</template>

<script setup lang="ts">
import { ClipboardDocumentIcon } from '@heroicons/vue/16/solid'

/** the share link for the editor's chart (engine/share.ts), with Copy; `link` is null while it's being made */
const props = defineProps<{ open: boolean; link: string | null }>()
const emit = defineEmits<{ close: [] }>()

const LONG_LINK = 8000
const copied = ref(false)
watch(
  () => props.link,
  () => {
    copied.value = false
  },
)

async function copy(): Promise<void> {
  if (!props.link) return
  try {
    await navigator.clipboard.writeText(props.link)
    copied.value = true
  } catch {
    copied.value = false // no clipboard access: the link is still there to select and copy
  }
}
</script>
