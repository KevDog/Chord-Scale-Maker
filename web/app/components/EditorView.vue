<template>
  <div class="space-y-6">
    <div class="grid gap-6 print:hidden lg:grid-cols-2">
      <section aria-labelledby="grid-heading" class="min-w-0">
        <h2 id="grid-heading" class="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Chart</h2>
        <p v-if="editor.fatal.value" class="rounded bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          This chart is over a size limit. Shorten it in the text editor to edit it here.
        </p>
        <div v-else class="max-h-[60vh] overflow-auto pr-1">
          <ChartGrid :doc="editor.doc.value" @update:doc="editor.setDoc" />
        </div>
      </section>
      <section aria-labelledby="text-heading" class="min-w-0">
        <h2 id="text-heading" class="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">Text</h2>
        <ChartText :text="editor.text.value" :diagnostics="editor.diagnostics.value" @update:text="editor.setText" />
      </section>
    </div>

    <div class="flex flex-wrap items-center gap-3 print:hidden">
      <h2 class="text-sm font-medium uppercase tracking-wide text-slate-500">Preview</h2>
      <fieldset class="flex overflow-hidden rounded-md border border-slate-300 text-sm dark:border-slate-700">
        <legend class="sr-only">Which spellings to show</legend>
        <label v-for="m in MODES" :key="m.value" class="cursor-pointer px-3 py-1 has-checked:bg-accent has-checked:text-white dark:has-checked:text-slate-950">
          <input v-model="mode" type="radio" name="mode" :value="m.value" class="sr-only" >{{ m.label }}
        </label>
      </fieldset>
      <button type="button" class="ml-auto rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong dark:text-slate-950" @click="print">
        Print / Save PDF
      </button>
    </div>

    <p v-if="editor.fatal.value" class="text-sm text-rose-600">Preview paused: the chart is over a size limit.</p>
    <ScaleSheet v-else :rows="editor.rows.value" :title="editor.meta.value.title" :subtitle="editor.meta.value.subtitle" :mode="mode" :per-page="PER_PAGE" />
  </div>
</template>

<script setup lang="ts">
import type { ModeChoice } from '~~/engine'

const props = defineProps<{ initialText: string }>()

const PER_PAGE = 12
const MODES: readonly { value: ModeChoice; label: string }[] = [
  { value: 'both', label: 'Both' },
  { value: 'from', label: 'From C' },
  { value: 'root', label: 'From root' },
]

const editor = useChartEditor(props.initialText)
const mode = ref<ModeChoice>('both')

watch(editor.text, (t) => saveDraft(t))

function print(): void {
  window.print()
}
</script>
