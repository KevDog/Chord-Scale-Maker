<template>
  <div class="space-y-10">
    <!-- page heading with actions (Application UI page-heading pattern, Catalyst parts) -->
    <div class="flex flex-wrap items-end justify-between gap-4 print:hidden">
      <div class="min-w-0">
        <UiHeading>{{ editor.meta.value.title || 'Untitled' }}</UiHeading>
        <UiText v-if="editor.meta.value.subtitle" class="mt-1">{{ editor.meta.value.subtitle }}</UiText>
      </div>
      <div class="flex flex-wrap gap-3 *:whitespace-nowrap">
        <ChartTranspose v-if="!editor.fatal.value" :current="currentDoc" @update:doc="editor.setDoc" @transposed="transposed = $event" />
        <UiButton color="teal" :disabled="editor.fatal.value" @click="print"><PrinterIcon data-slot="icon" />Print / Save PDF</UiButton>
      </div>
    </div>
    <UiText v-if="transposed" role="status" class="-mt-6 print:hidden">{{ transposed }}</UiText>

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
          <SegmentedControl v-if="guideTones" v-model="sheet" legend="Sheet" name="sheet" :options="SHEETS" />
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
          <SegmentedControl v-if="sheet === 'scales'" v-model="mode" legend="Where each scale starts" name="mode" :options="modes" />
          <UiField v-if="sheet === 'scales' && mode === 'from'" class="w-28">
            <UiLabel>Start on</UiLabel>
            <UiSelect v-model="prefs.start.value" aria-describedby="start-help">
              <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ noteText(r) }}</option>
            </UiSelect>
          </UiField>
          <UiButton v-bind="prefs.intervals.value ? { color: 'teal' } : { outline: true }" :aria-pressed="prefs.intervals.value" title="Label each note against the chord root (on screen only)" @click="prefs.intervals.value = !prefs.intervals.value">
            Intervals
          </UiButton>
        </div>
        <UiText id="start-help" class="sr-only">Written pitch the "from" part starts on</UiText>
        <UiText aria-live="polite">
          <template v-if="part.trans !== 'C'">The chart is in concert pitch; the preview is transposed for {{ instrumentOption(prefs.instrument.value).toLowerCase() }}.</template>
          <template v-else-if="part.clef === 'bass'">The preview is in bass clef, concert pitch, for {{ instrumentOption(prefs.instrument.value).toLowerCase() }}.</template>
        </UiText>
      </div>

      <UiText v-if="editor.fatal.value" class="text-red-600! dark:text-red-400!">Preview paused: the chart is over a size limit.</UiText>
      <GuideToneSheet
        v-else-if="sheet === 'guideTones'"
        :rows="editor.rows.value"
        :title="editor.meta.value.title"
        :subtitle="editor.meta.value.subtitle"
        :part="part"
        :instrument-label="instrumentLabel(prefs.instrument.value)"
        :intervals="prefs.intervals.value"
      />
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
        :intervals="prefs.intervals.value"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { PrinterIcon } from '@heroicons/vue/16/solid'
import { type ChartDoc, INSTRUMENTS, instrumentLabel, type Mode, noteText, partFor } from '~~/engine'

const props = defineProps<{ initialText: string }>()

const PER_PAGE = 12

const editor = useChartEditor(props.initialText)
const prefs = usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
/** one spelling at a time: every scale from the Start on note, or each from its own root */
const mode = ref<Mode>('root')
const transposed = ref('')
const guideTones = useFeature('guideTones')
type Sheet = 'scales' | 'guideTones'
const SHEETS: readonly { value: Sheet; label: string }[] = [
  { value: 'scales', label: 'Scales' },
  { value: 'guideTones', label: 'Guide tones' },
]
const sheet = ref<Sheet>('scales')
const modes = computed((): readonly { value: Mode; label: string }[] => [
  { value: 'from', label: `From ${noteText(prefs.start.value)}` },
  { value: 'root', label: 'From root' },
])

watch(editor.text, (t) => saveDraft(t))

/** the doc with anything typed in the last moment parsed in */
function currentDoc(): ChartDoc {
  editor.flush()
  return editor.doc.value
}

function print(): void {
  editor.flush() // include anything typed in the last moment
  nextTick(() => window.print())
}
</script>
