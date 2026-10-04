<template>
  <div class="space-y-10">
    <!-- page heading with actions (Application UI page-heading pattern, Catalyst parts) -->
    <div class="flex flex-wrap items-end justify-between gap-4 print:hidden">
      <div class="min-w-0">
        <UiHeading>{{ editor.meta.value.title || 'Untitled' }}</UiHeading>
        <UiText v-if="editor.meta.value.subtitle" class="mt-1">{{ editor.meta.value.subtitle }}</UiText>
      </div>
      <UiButton color="teal" :disabled="editor.fatal.value" @click="print"><PrinterIcon data-slot="icon" />Print / Save PDF</UiButton>
    </div>

    <div class="grid gap-8 print:hidden lg:grid-cols-2">
      <section aria-labelledby="grid-heading" class="min-w-0">
        <UiSubheading id="grid-heading" class="mb-3">Chart</UiSubheading>
        <div v-if="editor.fatal.value" class="rounded-lg bg-red-500/10 p-4 text-sm/6 text-red-700 dark:text-red-400">
          This chart is over a size limit. Shorten it in the text editor to edit it here.
        </div>
        <div v-else class="max-h-[60vh] overflow-auto pr-1">
          <ChartGrid :doc="editor.doc.value" @update:doc="editor.setDoc" />
        </div>
      </section>
      <section aria-labelledby="text-heading" class="min-w-0">
        <UiSubheading id="text-heading" class="mb-3">Text</UiSubheading>
        <ChartText :text="editor.text.value" :diagnostics="editor.diagnostics.value" @update:text="editor.setText" />
      </section>
    </div>

    <section aria-labelledby="preview-heading" class="space-y-6">
      <div class="space-y-4 print:hidden">
        <UiSubheading id="preview-heading">Preview</UiSubheading>
        <div class="flex flex-wrap items-end gap-4">
          <UiField class="w-60">
            <UiLabel>Instrument</UiLabel>
            <UiListbox v-model="prefs.instrument.value">
              <template #selected="{ value }"><UiListboxLabel>{{ instrumentOption(value) }}</UiListboxLabel></template>
              <UiListboxGroup v-for="g in INSTRUMENT_GROUPS" :key="g.label" :label="g.label">
                <UiListboxOption v-for="name in g.instruments" :key="name" :value="name">
                  <UiListboxLabel>{{ instrumentOption(name) }}</UiListboxLabel>
                  <UiListboxDescription>{{ INSTRUMENTS[name].description }}</UiListboxDescription>
                </UiListboxOption>
              </UiListboxGroup>
            </UiListbox>
          </UiField>
          <UiField class="w-28">
            <UiLabel>Start on</UiLabel>
            <UiSelect v-model="prefs.start.value" aria-describedby="start-help">
              <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ noteText(r) }}</option>
            </UiSelect>
          </UiField>
          <!-- segmented control (Application UI button-group pattern) over native radios -->
          <fieldset>
            <legend class="sr-only">Which spellings to show</legend>
            <span class="isolate inline-flex rounded-lg shadow-xs dark:shadow-none">
              <label
                v-for="m in modes"
                :key="m.value"
                class="relative -ml-px inline-flex cursor-default items-center bg-white px-3 py-2 text-sm/5 font-semibold text-zinc-950 ring-1 ring-zinc-950/10 ring-inset first:ml-0 first:rounded-l-lg last:rounded-r-lg hover:bg-zinc-50 has-checked:z-10 has-checked:bg-teal-600 has-checked:text-white has-checked:ring-teal-700 has-focus-visible:z-20 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-500 dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10 dark:has-checked:bg-teal-500 dark:has-checked:text-zinc-950"
              >
                <input v-model="mode" type="radio" name="mode" :value="m.value" class="sr-only">{{ m.label }}
              </label>
            </span>
          </fieldset>
        </div>
        <UiText id="start-help" class="sr-only">Written pitch the "from" part starts on</UiText>
        <UiText aria-live="polite">
          <template v-if="part.trans !== 'C'">The chart is in concert pitch; the preview is transposed for {{ instrumentOption(prefs.instrument.value).toLowerCase() }}.</template>
          <template v-else-if="part.clef === 'bass'">The preview is in bass clef, concert pitch, for {{ instrumentOption(prefs.instrument.value).toLowerCase() }}.</template>
        </UiText>
      </div>

      <UiText v-if="editor.fatal.value" class="text-red-600!">Preview paused: the chart is over a size limit.</UiText>
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
    </section>
  </div>
</template>

<script setup lang="ts">
import { PrinterIcon } from '@heroicons/vue/16/solid'
import { INSTRUMENTS, instrumentLabel, type ModeChoice, noteText, partFor } from '~~/engine'

const props = defineProps<{ initialText: string }>()

const PER_PAGE = 12

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
