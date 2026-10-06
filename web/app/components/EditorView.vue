<template>
  <div class="space-y-10">
    <div class="min-w-0 print:hidden">
      <UiHeading>{{ editor.meta.value.title || 'Untitled' }}</UiHeading>
      <UiText v-if="editor.meta.value.subtitle" class="mt-1">{{ editor.meta.value.subtitle }}</UiText>
    </div>

    <div class="grid gap-8 print:hidden lg:grid-cols-2">
      <section aria-labelledby="grid-heading" class="min-w-0">
        <UiSubheading id="grid-heading" class="mb-3">Chart</UiSubheading>
        <div v-if="editor.fatal.value" class="rounded-lg bg-red-500/10 p-4 text-sm/6 text-red-700 dark:text-red-400">
          This chart is over a size limit. Shorten it in the text editor to edit it here.
        </div>
        <div v-else class="max-h-[60vh] overflow-auto pr-1">
          <ChartGrid :doc="editor.doc.value" @update:doc="editor.setDoc">
            <template #actions>
              <div class="space-y-2">
                <div class="flex flex-wrap gap-3 *:whitespace-nowrap">
                  <ChartTranspose :current="currentDoc" @update:doc="editor.setDoc" @transposed="transposed = $event" />
                  <UiButton color="note" @click="print"><PrinterIcon data-slot="icon" />Print / Save PDF</UiButton>
                  <UiButton outline :disabled="editor.fatal.value" title="Show only the sheet music (Esc to leave)" @click="enterFocus"><ArrowsPointingOutIcon data-slot="icon" />Focus</UiButton>
                </div>
                <UiText v-if="transposed" role="status">{{ transposed }}</UiText>
              </div>
            </template>
          </ChartGrid>
        </div>
      </section>
      <section aria-labelledby="text-heading" class="min-w-0">
        <div class="mb-3 flex items-center gap-2">
          <UiSubheading id="text-heading">Text</UiSubheading>
          <HelpTip label="How the text editor works">
            <span class="block">One line per chord: <code class="font-mono text-xs whitespace-nowrap">section | bar | chord | scale</code>, in concert pitch. Leave the scale out to use the chord's default.</span>
            <span class="mt-2 block"><code class="font-mono text-xs">title:</code> and <code class="font-mono text-xs">subtitle:</code> set the heading, lines starting with <code class="font-mono text-xs">#</code> are comments, and <code class="font-mono text-xs">@copy A B 8</code> repeats section A as B, 8 bars later.</span>
            <span class="mt-2 block">The text and the grid stay in sync: edit either one. Problems are listed under the text.</span>
          </HelpTip>
        </div>
        <ChartText :text="editor.text.value" :diagnostics="editor.diagnostics.value" @update:text="editor.setText" />
      </section>
    </div>

    <!-- focus mode: this section alone, over the whole page (and printed as usual) -->
    <section
      v-bind="focus.on.value ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Focus mode' } : { 'aria-labelledby': 'preview-heading' }"
      :class="[
        'space-y-6',
        focus.on.value && 'fixed inset-0 z-50 overflow-y-auto bg-zinc-100 px-4 pb-8 dark:bg-zinc-900 print:static print:overflow-visible print:bg-white print:p-0',
      ]"
    >
      <div v-if="focus.on.value" ref="focusBar" class="sticky top-0 z-10 -mx-4 flex justify-end bg-zinc-100/90 px-4 py-3 backdrop-blur-sm dark:bg-zinc-900/90 print:hidden">
        <UiButton outline @click="focus.exit"><XMarkIcon data-slot="icon" />Exit focus<kbd class="ml-1 font-sans text-xs text-zinc-500 dark:text-zinc-400">Esc</kbd></UiButton>
      </div>
      <div v-show="!focus.on.value" class="space-y-4 print:hidden">
        <UiSubheading id="preview-heading">Preview</UiSubheading>
        <PreviewControls
          v-model:sheet="sheet"
          v-model:instrument="prefs.instrument.value"
          v-model:mode="mode"
          v-model:start="prefs.start.value"
          v-model:intervals="prefs.intervals.value"
        />
        <PracticePanel
          v-if="practiceOn && sheet === 'scales' && !editor.fatal.value"
          :mode="mode"
          :start-text="prefs.start.value"
          :boxes="practiceBoxesNow"
          :selection="selection"
          :lit="litNow"
          @update:selection="practice.setSelection(mode, $event)"
        />
      </div>

      <div :class="focus.on.value && 'mx-auto max-w-6xl print:max-w-none'">
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
          :practice="selection"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ArrowsPointingOutIcon, PrinterIcon, XMarkIcon } from '@heroicons/vue/16/solid'
import { buildSheet, type ChartDoc, instrumentLabel, LIMITS, litKeys, type Mode, partFor, practiceBoxes } from '~~/engine'
import type { SheetKind } from '~/utils/sheets'

/** chartSlug: the library chart being edited, if any (practice selections are remembered per chart) */
const props = defineProps<{ initialText: string; chartSlug?: string }>()

const PER_PAGE = 12

const editor = useChartEditor(props.initialText)
const prefs = usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
/** one spelling at a time: every scale from the Start on note, or each from its own root */
const mode = ref<Mode>('root')
const sheet = ref<SheetKind>('scales')
const practiceOn = useFeature('practice')
const practice = usePractice(props.chartSlug)
const selection = computed(() => (practiceOn ? practice.selection(mode.value) : null))
// every staff with its practice keys, for the panel's boxes and what the selection lights
const practiceStaves = computed(() =>
  practiceOn ? buildSheet(editor.rows.value, part.value, mode.value, prefs.start.value, LIMITS.maxExpandedRows, selection.value).flatMap((p) => p.pages.flat()) : [],
)
const practiceBoxesNow = computed(() => practiceBoxes(practiceStaves.value, mode.value, prefs.start.value))
const litNow = computed(() => litKeys(practiceStaves.value))
const transposed = ref('')
const focus = useFocusMode()
const focusBar = ref<HTMLElement | null>(null)

watch(editor.text, (t) => saveDraft(t))

/** the doc with anything typed in the last moment parsed in */
function currentDoc(): ChartDoc {
  editor.flush()
  return editor.doc.value
}

/** focus mode, with keyboard focus on its exit button */
function enterFocus(): void {
  editor.flush()
  focus.enter()
  nextTick(() => focusBar.value?.querySelector('button')?.focus())
}

function print(): void {
  editor.flush() // include anything typed in the last moment
  nextTick(() => window.print())
}
</script>
