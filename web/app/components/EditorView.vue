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
      <label class="flex items-center gap-2 text-sm">
        <span class="text-slate-500 dark:text-slate-400">Instrument</span>
        <select v-model="prefs.instrument.value" :class="control">
          <optgroup v-for="g in INSTRUMENT_GROUPS" :key="g.label" :label="g.label">
            <option v-for="name in g.instruments" :key="name" :value="name" :title="INSTRUMENTS[name].description">{{ instrumentOption(name) }}</option>
          </optgroup>
        </select>
      </label>
      <label class="flex items-center gap-2 text-sm">
        <span class="text-slate-500 dark:text-slate-400">Start on</span>
        <select v-model="prefs.start.value" :class="control" aria-describedby="start-help">
          <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ noteText(r) }}</option>
        </select>
        <span id="start-help" class="sr-only">Written pitch the "from" part starts on</span>
      </label>
      <fieldset class="flex overflow-hidden rounded-md border border-slate-300 text-sm dark:border-slate-700">
        <legend class="sr-only">Which spellings to show</legend>
        <label v-for="m in modes" :key="m.value" class="cursor-pointer px-3 py-1 has-checked:bg-accent has-checked:text-white has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-sky-600 dark:has-checked:text-slate-950 dark:has-focus-visible:outline-sky-400">
          <input v-model="mode" type="radio" name="mode" :value="m.value" class="sr-only" >{{ m.label }}
        </label>
      </fieldset>
      <button type="button" class="ml-auto rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong dark:text-slate-950" @click="print">
        Print / Save PDF
      </button>
    </div>

    <p v-if="part.trans !== 'C' || part.clef === 'bass'" class="text-sm text-slate-500 print:hidden dark:text-slate-400">
      The chart is in concert pitch; the preview is written for {{ instrumentOption(prefs.instrument.value).toLowerCase() }}.
    </p>
    <p v-if="editor.fatal.value" class="text-sm text-rose-600">Preview paused: the chart is over a size limit.</p>
    <ScaleSheet
      v-else
      :rows="editor.rows.value"
      :title="editor.meta.value.title"
      :subtitle="editor.meta.value.subtitle"
      :part="part"
      :instrument-label="instrumentLabel(prefs.instrument.value)"
      :start="prefs.start.value"
      :mode="mode"
      :per-page="PER_PAGE"
    />
  </div>
</template>

<script setup lang="ts">
import { INSTRUMENTS, instrumentLabel, type ModeChoice, noteText, partFor } from '~~/engine'

const props = defineProps<{ initialText: string }>()

const PER_PAGE = 12
const control = 'rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900'

const editor = useChartEditor(props.initialText)
const prefs = usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
const mode = ref<ModeChoice>('both')
const modes = computed((): readonly { value: ModeChoice; label: string }[] => [
  { value: 'both', label: 'Both' },
  { value: 'from', label: `From ${noteText(prefs.start.value)}` },
  { value: 'root', label: 'From root' },
])

watch(editor.text, (t) => saveDraft(t))

function print(): void {
  editor.flush() // include anything typed in the last moment
  nextTick(() => window.print())
}
</script>
