<template>
  <div>
    <p id="attachment-label" class="text-base/6 font-medium text-zinc-950 select-none sm:text-sm/6 dark:text-white">
      Attachment <span class="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
    </p>
    <UiText id="attachment-help" class="mt-1">If you have a chart you'd like added, a photo or PDF of it would be very helpful.</UiText>

    <div v-if="model" class="mt-3 flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-zinc-950/10 dark:ring-white/10">
      <PaperClipIcon class="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
      <p class="min-w-0 flex-1 text-sm/6 text-zinc-950 dark:text-white">
        <span class="block truncate font-medium">{{ model.attachment.filename }}</span>
        <span class="text-zinc-500 dark:text-zinc-400">{{ formatSize(model.size) }}{{ model.shrunk ? ', shrunk to send' : '' }}</span>
      </p>
      <UiButton plain :disabled="disabled" :aria-label="`Remove ${model.attachment.filename}`" @click="model = null"><XMarkIcon data-slot="icon" />Remove</UiButton>
    </div>

    <div
      v-else
      :class="[
        'mt-3 flex flex-col items-center rounded-lg border border-dashed px-6 py-8 text-center transition',
        dragging ? 'border-note-500 bg-note-50 dark:border-note-400 dark:bg-note-950' : 'border-zinc-950/25 dark:border-white/25',
        disabled && 'opacity-50',
      ]"
      @dragover.prevent="dragging = !disabled"
      @dragleave="onLeave"
      @drop.prevent="onDrop"
    >
      <DocumentArrowUpIcon class="size-10 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
      <p class="mt-3 text-sm/6 text-zinc-600 dark:text-zinc-400">
        <span v-if="preparing" role="status">Preparing the file…</span>
        <template v-else>
          <label
            class="cursor-pointer rounded-sm font-semibold text-note-700 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-note-500 hover:text-note-600 dark:text-note-300 dark:hover:text-note-200"
          >
            <span>Browse</span>
            <input
              ref="input"
              type="file"
              class="sr-only"
              :accept="ACCEPT"
              :disabled="disabled"
              aria-labelledby="attachment-label"
              :aria-describedby="`attachment-help attachment-types${problem ? ' attachment-error' : ''}`"
              :aria-invalid="problem ? 'true' : undefined"
              @change="onPick"
            >
          </label>
          or drag and drop a file here
        </template>
      </p>
      <p id="attachment-types" class="mt-1 text-xs/5 text-zinc-500 dark:text-zinc-400">JPG, PNG or PDF, up to 10 MB. Large photos are shrunk to send; PDFs up to 3 MB.</p>
    </div>

    <p v-if="problem" id="attachment-error" role="alert" class="mt-3 text-base/6 text-red-600 sm:text-sm/6 dark:text-red-500">{{ problem }}</p>
  </div>
</template>

<script setup lang="ts">
import { DocumentArrowUpIcon, PaperClipIcon } from '@heroicons/vue/24/outline'
import { XMarkIcon } from '@heroicons/vue/16/solid'
import { formatSize, prepareAttachment, type ReadyAttachment } from '~/utils/attachment'
import { ATTACHMENT_TYPES } from '../../server/utils/contactMessage'

/** the contact form's optional attachment: browse or drag and drop one JPG, PNG or PDF (utils/attachment.ts) */
const props = defineProps<{ disabled?: boolean; error?: string }>()
const model = defineModel<ReadyAttachment | null>({ required: true })
const preparing = defineModel<boolean>('preparing', { default: false })

const ACCEPT = Object.entries(ATTACHMENT_TYPES)
  .flatMap(([type, exts]) => [type, ...exts.map((e) => `.${e}`)])
  .join(',')
const dragging = ref(false)
const local = ref('')
const input = ref<HTMLInputElement | null>(null)
const problem = computed(() => local.value || props.error || '')

async function take(file: File | undefined): Promise<void> {
  if (!file || props.disabled || preparing.value) return
  local.value = ''
  preparing.value = true
  try {
    const r = await prepareAttachment(file)
    if (r.ok) model.value = r.value
    else local.value = r.error
  } catch {
    local.value = "The file couldn't be read. Please try it again."
  } finally {
    preparing.value = false
    if (input.value) input.value.value = '' // choosing the same file again still fires change
  }
}

const onPick = (e: Event): Promise<void> => take((e.target as HTMLInputElement).files?.[0])
function onDrop(e: DragEvent): Promise<void> {
  dragging.value = false
  return take(e.dataTransfer?.files[0])
}
function onLeave(e: DragEvent): void {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) dragging.value = false
}
</script>
