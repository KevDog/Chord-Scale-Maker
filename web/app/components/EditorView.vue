<template>
  <div class="space-y-10">
    <div class="min-w-0 print:hidden">
      <UiHeading>{{ editor.meta.value.title || 'Untitled' }}</UiHeading>
      <UiText v-if="byline" class="mt-1">{{ byline }}</UiText>
      <!-- My charts: where this chart is saved, and what you can do with it -->
      <div v-if="saved || shared" class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <UiText v-if="saved" role="status" :class="['text-sm/6!', saved.status.value.state === 'failed' && 'text-red-700! dark:text-red-400!']">{{ saveText }}</UiText>
        <UiText v-else role="status" class="text-sm/6!">A shared chart. It isn’t saved in this browser until you save it.</UiText>
        <UiButton v-if="shared" color="note" :disabled="editor.fatal.value" @click="saveShared"><BookmarkIcon data-slot="icon" />Save to My charts</UiButton>
        <UiButton v-if="saved?.edited.value" plain @click="revertOpen = true"><ArrowUturnLeftIcon data-slot="icon" />Revert to library version</UiButton>
        <UiButton v-if="saved" outline :disabled="editor.fatal.value" @click="saveCopy"><DocumentDuplicateIcon data-slot="icon" />Save as a copy</UiButton>
        <UiButton outline @click="download"><ArrowDownTrayIcon data-slot="icon" />Download</UiButton>
        <UiButton outline :disabled="editor.fatal.value" @click="openShare"><LinkIcon data-slot="icon" />Share</UiButton>
      </div>
      <UiText v-if="copyError" role="alert" class="mt-2 text-sm/6! text-red-700! dark:text-red-400!">{{ copyError }}</UiText>
    </div>

    <ShareDialog :open="shareOpen" :link="shareLink" @close="shareOpen = false" />

    <UiDialog :open="revertOpen" size="md" @close="revertOpen = false">
      <UiDialogTitle>Revert to the library version?</UiDialogTitle>
      <UiDialogDescription>Your edits to {{ libraryTitle }} are removed from this browser. To keep them as well, Save as a copy first.</UiDialogDescription>
      <UiDialogActions>
        <UiButton plain @click="revertOpen = false">Cancel</UiButton>
        <UiButton color="note" @click="revert">Revert</UiButton>
      </UiDialogActions>
    </UiDialog>

    <div :class="['grid gap-8 print:hidden', textShown && 'lg:grid-cols-2']">
      <section aria-labelledby="grid-heading" class="min-w-0">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <UiSubheading id="grid-heading">Chart</UiSubheading>
          <UiButton
            plain
            :aria-expanded="textShown"
            aria-controls="text-pane"
            :disabled="editor.fatal.value"
            @click="prefs.showText.value = !prefs.showText.value"
          >
            <CodeBracketIcon data-slot="icon" />{{ textShown ? 'Hide text' : 'Show text' }}
          </UiButton>
        </div>
        <!-- Level: how sophisticated each chord's scale is, written into the chart (engine/levels.ts) -->
        <div v-if="levelsOn && !editor.fatal.value" class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span id="scale-level-label" class="text-sm/6 font-medium text-zinc-950 dark:text-white">Scale level</span>
          <SegmentedControl :model-value="scaleLevel.level.value" legend="Scale level" name="scale-level" :options="LEVEL_OPTIONS" @update:model-value="setLevel" />
          <UiButton v-if="scaleLevel.level.value === 'random'" outline title="Deal a new random scale for each chord" @click="shuffle"><ArrowPathIcon data-slot="icon" />Shuffle</UiButton>
          <UiText v-if="levelNote" role="status" class="text-sm/6!">{{ levelNote }}</UiText>
        </div>
        <UiText v-if="!textShown && editor.diagnostics.value.length" role="status" class="mb-3 text-amber-700! dark:text-amber-400!">
          The chart's text has {{ editor.diagnostics.value.length === 1 ? 'a problem' : `${editor.diagnostics.value.length} problems` }}.
          <button type="button" class="font-semibold underline" @click="prefs.showText.value = true">Show text</button> to see {{ editor.diagnostics.value.length === 1 ? 'it' : 'them' }}.
        </UiText>
        <div v-if="editor.fatal.value" class="rounded-lg bg-red-500/10 p-4 text-sm/6 text-red-700 dark:text-red-400">
          This chart is over a size limit. Shorten it in the text editor to edit it here.
        </div>
        <div v-else class="max-h-[60vh] overflow-auto pr-1">
          <ChartGrid :doc="editor.doc.value" @update:doc="editor.setDoc" />
        </div>
      </section>
      <section v-show="textShown" id="text-pane" aria-labelledby="text-heading" class="min-w-0">
        <div class="mb-3 flex items-center gap-2">
          <UiSubheading id="text-heading">Text</UiSubheading>
          <HelpTip label="How the text editor works">
            <span class="block">One line per chord: <code class="font-mono text-xs whitespace-nowrap">section | bar | chord | scale</code>, in concert pitch. Leave the scale out to use the chord's default.</span>
            <span class="mt-2 block"><code class="font-mono text-xs">title:</code>, <code class="font-mono text-xs">subtitle:</code>, <code class="font-mono text-xs">composer:</code>, <code class="font-mono text-xs">key:</code> and <code class="font-mono text-xs">form:</code> set the heading, lines starting with <code class="font-mono text-xs">#</code> are comments, and <code class="font-mono text-xs">@copy A B 8</code> repeats section A as B, 8 bars later.</span>
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
          v-model:numerals="prefs.numerals.value"
          v-model:scale-names="prefs.scaleNames.value"
        >
          <!-- the chart's actions, after Intervals (none while the chart is over a size limit) -->
          <template v-if="!editor.fatal.value" #actions>
            <ChartTranspose :current="currentDoc" @update:doc="editor.setDoc" @transposed="transposed = $event" />
            <UiButton outline title="Show only the sheet music (Esc to leave)" @click="enterFocus"><ArrowsPointingOutIcon data-slot="icon" />Focus</UiButton>
            <UiButton color="note" title="Print, or save a PDF from the print dialog" @click="print"><PrinterIcon data-slot="icon" />Print</UiButton>
          </template>
        </PreviewControls>
        <UiText v-if="transposed" role="status">{{ transposed }}</UiText>
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
        <ChangesSheet
          v-else-if="sheet === 'changes'"
          :doc="editor.doc.value"
          :title="editor.meta.value.title"
          :subtitle="editor.heading.value.subtitle"
          :composer="editor.heading.value.composer"
          :part="part"
          :instrument-label="instrumentLabel(prefs.instrument.value)"
          :numerals="prefs.numerals.value"
          :scales="prefs.scaleNames.value"
        />
        <GuideToneSheet
          v-else-if="sheet === 'guideTones'"
          :rows="editor.rows.value"
          :title="editor.meta.value.title"
          :subtitle="editor.heading.value.subtitle"
          :composer="editor.heading.value.composer"
          :part="part"
          :instrument-label="instrumentLabel(prefs.instrument.value)"
          :beats="editor.beats.value"
          :intervals="prefs.intervals.value"
        />
        <ScaleSheet
          v-else
          :rows="editor.rows.value"
          :title="editor.meta.value.title"
          :subtitle="editor.heading.value.subtitle"
          :composer="editor.heading.value.composer"
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
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowsPointingOutIcon, ArrowUturnLeftIcon, BookmarkIcon, CodeBracketIcon, DocumentDuplicateIcon, LinkIcon, PrinterIcon, XMarkIcon } from '@heroicons/vue/16/solid'
import {
  buildSheet,
  type ChartDoc,
  encodeShare,
  instrumentLabel,
  LEVEL_LABELS,
  parseChart,
  LIMITS,
  litKeys,
  type Mode,
  partFor,
  practiceBoxes,
  relevel,
  SCALE_LEVELS,
  type LevelState,
  type ScaleLevel,
  serializeChart,
  setMeta,
  type ShareView,
} from '~~/engine'
import type { SaveTarget } from '~/composables/useSavedChart'
import type { SheetKind } from '~/utils/sheets'

/**
 * practiceKey: what practice selections are remembered under (a library slug, or mine:<id>); none for the visit only.
 * saveTarget: where edits save (My charts); none when the feature is off. libraryTitle: the library chart's title.
 * shared: opened from a share link, with the view it carried (applied for this visit, not saved).
 */
const props = defineProps<{ initialText: string; practiceKey?: string; saveTarget?: SaveTarget; libraryTitle?: string; shared?: ShareView }>()
const emit = defineEmits<{ created: [id: string]; reload: [] }>()

const PER_PAGE = 12

const editor = useChartEditor(props.initialText)
/** under the heading: "Ballad · E♭ · AABA, 32 bars — Johnny Green" */
const byline = computed(() => [editor.heading.value.subtitle, editor.heading.value.composer].filter(Boolean).join(' — '))
const prefs = props.shared ? linkPreferences(props.shared) : usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
/** the Text pane: hidden by default, and always shown for a chart over a size limit (only the text can fix it) */
const textShown = computed(() => prefs.showText.value || editor.fatal.value)
/** one spelling at a time: every scale from the Start on note, or each from its own root */
const mode = ref<Mode>(props.shared?.mode ?? 'root')
const sharedSheet = props.shared?.sheet
const sheet = ref<SheetKind>(
  sharedSheet === 'guideTones' && useFeature('guideTones') ? 'guideTones' : sharedSheet === 'changes' && useFeature('changes') ? 'changes' : 'scales',
)
const practiceOn = useFeature('practice')
const practice = usePractice(props.practiceKey)
const levelsOn = useFeature('scaleLevels')
const scaleLevel = useScaleLevel(props.practiceKey, props.shared)
const LEVEL_OPTIONS = SCALE_LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }))
const level = computed(() => (levelsOn ? scaleLevel.level.value : 'standard'))
const levelNote = ref('')

/** move the chart's scales to another level: rows playing the old level's scale take the new one's */
/** the library chart this one came from (itself, or the source of a copy): its own scale choices are its Standard */
const baseline = ((): ChartDoc | undefined => {
  const t = props.saveTarget
  const slug = t?.kind === 'library' ? t.slug : t?.kind === 'mine' ? loadChart(t.id)?.meta.basedOn : t?.kind === 'new' ? t.basedOn : undefined
  const text = slug ? findChart(slug)?.text : undefined
  return text === undefined ? undefined : parseChart(text).value
})()
const levelState = (): LevelState => ({ level: scaleLevel.level.value, seed: scaleLevel.seed.value, ...(scaleLevel.owned.value ? { owned: scaleLevel.owned.value } : {}) })
function moveLevel(to: ScaleLevel, seed: number, from: LevelState = levelState()): void {
  editor.flush()
  const result = relevel(editor.doc.value, from, { level: to, seed }, baseline)
  if (result.changed) editor.setDoc(result.doc)
  scaleLevel.owned.value = to === 'standard' ? undefined : result.owned
  scaleLevel.level.value = to
  levelNote.value = result.changed
    ? `${result.changed === 1 ? '1 chord' : `${result.changed} chords`} moved to ${LEVEL_LABELS[to].toLowerCase()} scales; any you chose yourself stay.`
    : 'No scales to change: they’re all your own choices, or already at this level.'
}
const setLevel = (to: ScaleLevel): void => moveLevel(to, scaleLevel.seed.value)
function shuffle(): void {
  const from = levelState()
  scaleLevel.shuffle()
  moveLevel('random', scaleLevel.seed.value, from)
}
if (props.shared?.practice) practice.setSelection(mode.value, props.shared.practice)
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

const saved = props.saveTarget ? useSavedChart(editor.text, props.saveTarget, (id) => emit('created', id)) : null
const revertOpen = ref(false)
const copyError = ref('')

const timeText = (at: number): string => {
  const d = new Date(at)
  const today = d.toDateString() === new Date().toDateString()
  return today ? `at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `on ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
}
const saveText = computed((): string => {
  const s = saved?.status.value
  if (!s) return ''
  if (s.state === 'pending') return 'Saving…'
  if (s.state === 'failed')
    return s.reason === 'tooLong'
      ? `Not saved: it's over ${LIMITS.maxChars.toLocaleString()} characters.`
      : "Not saved: this browser's storage is full, or My charts is at its limit. Delete a chart you don't need."
  if (s.state === 'saved')
    return props.libraryTitle ? `Your edited version of ${props.libraryTitle}, saved in this browser ${timeText(s.at)}.` : `Saved in this browser ${timeText(s.at)}.`
  return props.saveTarget?.kind === 'library' ? 'Edits are saved in this browser as your version.' : 'Saved in this browser once you start editing.'
})

/** a copy of the chart as it is now, opened in its place */
function saveCopy(): void {
  editor.flush()
  saved?.flush()
  const doc = setMeta(editor.doc.value, 'title', `${editor.meta.value.title || 'Untitled'} (copy)`)
  const target = props.saveTarget
  const basedOn = target?.kind === 'library' ? target.slug : target?.kind === 'mine' ? loadChart(target.id)?.meta.basedOn : undefined
  const id = newChartId()
  const result = saveChart({ id, text: serializeChart(doc), kind: 'copy', ...(basedOn ? { basedOn } : {}) })
  copyError.value = result.ok ? '' : "Couldn't save a copy: this browser's storage is full, or My charts is at its limit."
  if (!result.ok) return
  scaleLevel.carryTo(`mine:${id}`)
  navigateTo({ path: '/song', query: { mine: id } })
}

const shareOpen = ref(false)
const shareLink = ref<string | null>(null)

/** a link carrying the chart as it is now, and how it's being viewed */
async function openShare(): Promise<void> {
  editor.flush()
  saved?.flush()
  shareLink.value = null
  shareOpen.value = true
  const view: ShareView = {
    instrument: prefs.instrument.value,
    mode: mode.value,
    start: prefs.start.value,
    intervals: prefs.intervals.value,
    numerals: prefs.numerals.value,
    scaleNames: prefs.scaleNames.value,
    sheet: sheet.value,
    ...(selection.value ? { practice: selection.value } : {}),
    ...(level.value !== 'standard' ? { level: level.value, seed: scaleLevel.seed.value } : {}),
  }
  shareLink.value = `${location.origin}/song#s=${await encodeShare({ chart: editor.text.value, view })}`
}

/** a shared chart, kept: into My charts with its practice picks, then opened at its own address */
function saveShared(): void {
  editor.flush()
  const id = newChartId()
  const result = saveChart({ id, text: editor.text.value, kind: 'new' })
  copyError.value = result.ok ? '' : "Couldn't save it: this browser's storage is full, or My charts is at its limit."
  if (!result.ok) return
  const kept = usePractice(`mine:${id}`)
  for (const m of ['root', 'from'] as const) kept.setSelection(m, practice.selection(m))
  scaleLevel.carryTo(`mine:${id}`)
  navigateTo({ path: '/song', query: { mine: id } })
}

/** the chart as a .txt file, as it is now */
function download(): void {
  editor.flush()
  saved?.flush()
  downloadText(filenameFor(editor.meta.value.title || 'Untitled'), editor.text.value)
}

function revert(): void {
  revertOpen.value = false
  const id = saved?.id()
  if (id) deleteChart(id)
  saved?.forget()
  scaleLevel.reset() // the library's scales are at Standard
  emit('reload')
}

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
