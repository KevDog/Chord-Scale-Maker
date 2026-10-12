<template>
  <div class="space-y-10">
    <div class="min-w-0 print:hidden">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <UiHeading>{{ editor.meta.value.title || 'Untitled' }}</UiHeading>
        <UiButton v-if="!editor.fatal.value" color="note" :aria-expanded="editorShown" title="Show or hide the chart editor" @click="toggleEditor"><PencilSquareIcon data-slot="icon" />{{ editorShown ? 'Done' : 'Edit' }}</UiButton>
      </div>
      <UiText v-if="byline" class="mt-1">{{ byline }}</UiText>
      <UiText v-if="sheetEditing" class="mt-1 md:hidden">Full editing works on a larger screen. Tap a chord on the sheet to change it.</UiText>
      <!-- My charts: where this chart is saved, and what you can do with it -->
      <div v-if="saved || shared" class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <UiText v-if="saved" role="status" :class="['text-sm/6!', saved.status.value.state === 'failed' && 'text-red-700! dark:text-red-400!']">{{ saveText }}</UiText>
        <UiText v-else role="status" class="text-sm/6!">A shared chart. It isn’t saved in this browser until you save it.</UiText>
        <UiButton v-if="shared" color="note" :disabled="editor.fatal.value" @click="saveShared"><BookmarkIcon data-slot="icon" />Save to My charts</UiButton>
        <UiButton v-if="saved?.edited.value" plain @click="revertOpen = true"><ArrowUturnLeftIcon data-slot="icon" />Revert to library version</UiButton>
        <UiButton v-if="saved" color="note" :disabled="editor.fatal.value" @click="saveCopy"><DocumentDuplicateIcon data-slot="icon" />Save as a copy</UiButton>
        <UiButton color="note" @click="download"><ArrowDownTrayIcon data-slot="icon" />Download</UiButton>
        <UiButton color="note" :disabled="editor.fatal.value" @click="openShare"><LinkIcon data-slot="icon" />Share</UiButton>
      </div>
      <UiText v-if="copyError" role="alert" class="mt-2 text-sm/6! text-red-700! dark:text-red-400!">{{ copyError }}</UiText>
    </div>

    <ShareDialog :open="shareOpen" :link="shareLink" @close="shareOpen = false" />
    <SheetChordEditor :doc="editor.doc.value" :target="sheetChord" @update:doc="editor.setDoc" @said="said = $event" @close="sheetChord = null" />
    <p class="sr-only" aria-live="polite">{{ said }}</p>

    <UiDialog :open="revertOpen" size="md" @close="revertOpen = false">
      <UiDialogTitle>Revert to the library version?</UiDialogTitle>
      <UiDialogDescription>Your edits to {{ libraryTitle }} are removed from this browser. To keep them as well, Save as a copy first.</UiDialogDescription>
      <UiDialogActions>
        <UiButton plain @click="revertOpen = false">Cancel</UiButton>
        <UiButton color="note" @click="revert">Revert</UiButton>
      </UiDialogActions>
    </UiDialog>

    <!-- the working area, set off from the header in a tinted box (Blue Note palette); muted text darkens to
         zinc-600 on the tint so it keeps AA contrast (zinc-500 would drop below 4.5:1 on any non-white background) -->
    <div class="space-y-8 rounded-2xl bg-note-100 p-5 ring-1 ring-note-200 sm:p-6 [&_[data-slot=text]]:text-zinc-600 [&_th]:text-zinc-600 dark:bg-white/5 dark:ring-white/10 dark:[&_[data-slot=text]]:text-zinc-400 dark:[&_th]:text-zinc-400 print:rounded-none print:bg-transparent print:p-0 print:ring-0">
      <UiText v-if="!editorShown && editor.diagnostics.value.length" role="status" class="text-amber-800! print:hidden dark:text-amber-400!">
        The chart's text has {{ editor.diagnostics.value.length === 1 ? 'a problem' : `${editor.diagnostics.value.length} problems` }}.
        <button type="button" class="font-semibold underline" @click="toggleEditor">Edit</button> to fix {{ editor.diagnostics.value.length === 1 ? 'it' : 'them' }}.
      </UiText>
  
      <!-- the bar editor: the chart as bars with an inspector, its text under ⋯ as the Source -->
      <div v-if="editorShown" class="space-y-8 print:hidden" @keydown="chartHistory.onKeydown">
        <section aria-labelledby="grid-heading" class="min-w-0 space-y-5">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <UiSubheading id="grid-heading">Chart</UiSubheading>
            <UiBadge color="zinc" title="The chart is written and edited in concert pitch, whatever the instrument">Concert pitch</UiBadge>
            <div class="ml-auto flex flex-wrap items-center justify-end gap-1">
              <UiButton plain :disabled="!chartHistory.canUndo.value" title="Undo (⌘Z)" @click="chartHistory.undo"><ArrowUturnLeftIcon data-slot="icon" />Undo</UiButton>
              <UiButton plain :disabled="!chartHistory.canRedo.value" title="Redo (⇧⌘Z)" @click="chartHistory.redo"><ArrowUturnRightIcon data-slot="icon" />Redo</UiButton>
              <UiButton v-if="saved || shared" plain :disabled="!unsaved" title="Save in this browser now (edits also save a moment after you stop)" @click="saveNow"><BookmarkIcon data-slot="icon" />Save</UiButton>
              <UiDropdown>
                <UiDropdownButton plain aria-label="More editing options"><EllipsisHorizontalIcon data-slot="icon" /></UiDropdownButton>
                <UiDropdownMenu anchor="end">
                  <UiDropdownItem @click="prefs.source.value = !sourceShown"><CodeBracketIcon data-slot="icon" />{{ sourceShown ? 'Hide source' : 'Show source' }}</UiDropdownItem>
                </UiDropdownMenu>
              </UiDropdown>
            </div>
          </div>
          <div v-if="editor.fatal.value" class="rounded-lg bg-red-500/10 p-4 text-sm/6 text-red-700 dark:text-red-400">
            This chart is over a size limit. Shorten it in the Source to edit it here.
          </div>
          <template v-else>
            <ChartHeadingFields :doc="editor.doc.value" @update:doc="editor.setDoc" />
            <!-- below md, light edits only: chords are changed on the Changes sheet -->
            <div class="max-md:hidden">
              <BarEditor ref="barEditor" :doc="editor.doc.value" @update:doc="editor.setDoc" @source="prefs.source.value = true" @selected="selectedLine = $event" />
            </div>
          </template>
        </section>
        <section v-if="sourceShown" id="text-pane" aria-labelledby="text-heading" class="min-w-0">
          <div class="relative mb-3 flex items-center gap-2">
            <UiSubheading id="text-heading">Source</UiSubheading>
            <HelpTip label="How the text editor works">
              <span class="block">One line per chord: <code class="font-mono text-xs whitespace-nowrap">section | bar | chord | scale<template v-if="functionsOn"> | function</template></code>, in concert pitch. Leave the scale out to use the chord's default.</span>
              <span class="mt-2 block"><code class="font-mono text-xs">title:</code>, <code class="font-mono text-xs">subtitle:</code>, <code class="font-mono text-xs">composer:</code>, <code class="font-mono text-xs">key:</code> and <code class="font-mono text-xs">form:</code> set the heading, lines starting with <code class="font-mono text-xs">#</code> are comments, and <code class="font-mono text-xs">@copy A B 8</code> repeats section A as B, 8 bars later<template v-if="functionsOn">, and <code class="font-mono text-xs">@key B 17 D</code> puts bars from B 17 in D until the next @key</template>.</span>
              <span class="mt-2 block">The Source and the bars stay in sync: edit either one. Problems are listed under the text.</span>
            </HelpTip>
            <UiButton v-if="!editor.fatal.value" plain class="ml-auto" @click="prefs.source.value = false">Hide source</UiButton>
          </div>
          <ChartText :text="editor.text.value" :diagnostics="editor.diagnostics.value" @update:text="editor.setText" />
        </section>
        <UiText v-else-if="editor.diagnostics.value.length" role="status" class="text-amber-800! dark:text-amber-400!">
          The chart's text has {{ editor.diagnostics.value.length === 1 ? 'a problem' : `${editor.diagnostics.value.length} problems` }}.
          <button type="button" class="font-semibold underline" @click="prefs.source.value = true">Show the source</button> to fix {{ editor.diagnostics.value.length === 1 ? 'it' : 'them' }}.
        </UiText>
      </div>

      <!-- focus mode: this section alone, over the whole page (and printed as usual) -->
      <section
        v-bind="focus.on.value ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Focus mode' } : { 'aria-label': 'Preview' }"
        :class="[
          'space-y-6',
          focus.on.value && 'fixed inset-0 z-50 overflow-y-auto bg-zinc-100 px-4 pb-8 dark:bg-zinc-900 print:static print:overflow-visible print:bg-white print:p-0',
        ]"
      >
        <div v-if="focus.on.value" ref="focusBar" class="sticky top-0 z-10 -mx-4 flex justify-end bg-zinc-100/90 px-4 py-3 backdrop-blur-sm dark:bg-zinc-900/90 print:hidden">
          <UiButton outline @click="focus.exit"><XMarkIcon data-slot="icon" />Exit focus<kbd class="ml-1 font-sans text-xs text-zinc-500 dark:text-zinc-400">Esc</kbd></UiButton>
        </div>
        <div v-show="!focus.on.value" class="space-y-4 print:hidden">
          <!-- the sheet is the editor (leadSheetEditor, from md up): a banner says so, in concert pitch, with Source and Done editing (Undo is on the grid toolbar above) -->
          <div v-if="sheetEditor" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-note-800 px-4 py-2 text-sm text-white dark:bg-note-900">
            <span class="font-semibold">Editing the sheet</span>
            <span v-if="concertNote" class="text-note-100">{{ concertNote }}</span>
            <span class="flex items-center gap-2">
              <UiButton plain class="text-white! hover:bg-white/10!" :aria-pressed="sourceShown" title="Show or hide the chart's text" @click="prefs.source.value = !sourceShown"><CodeBracketIcon data-slot="icon" class="text-white!" />Source</UiButton>
              <UiButton color="white" @click="toggleEditor">Done editing</UiButton>
            </span>
          </div>
          <PreviewControls
            v-model:sheet="sheet"
            v-model:instrument="prefs.instrument.value"
            v-model:mode="mode"
            v-model:start="prefs.start.value"
            v-model:intervals="prefs.intervals.value"
            v-model:numerals="prefs.numerals.value"
            v-model:scale-names="prefs.scaleNames.value"
            v-model:guide-line="prefs.guideLine.value"
            :lock-labels="sheetEditor"
          >
            <!-- Level: how sophisticated each chord's scale is (engine/src/levels.ts); a dropdown in the toolbar -->
            <template v-if="!editor.fatal.value" #level>
              <UiListbox :model-value="scaleLevel.level.value" class="w-32" @update:model-value="(v) => v && (scaleLevel.level.value = v)">
                <template #selected="{ value }"><UiListboxLabel>{{ levelLabel(value) }}</UiListboxLabel></template>
                <UiListboxOption v-for="o in LEVEL_OPTIONS" :key="o.value" :value="o.value"><UiListboxLabel>{{ o.label }}</UiListboxLabel></UiListboxOption>
              </UiListbox>
              <UiButton v-if="scaleLevel.level.value === 'random'" color="note" aria-label="Shuffle" title="Deal a new random scale for each chord" @click="scaleLevel.shuffle"><ArrowPathIcon data-slot="icon" /></UiButton>
            </template>
            <template v-if="!editor.fatal.value" #transpose>
              <ChartTranspose :current="currentDoc" @update:doc="editor.setDoc" @transposed="transposed = $event" />
            </template>
            <template v-if="!editor.fatal.value" #display>
              <UiButton color="note" title="Show only the sheet music (Esc to leave)" @click="enterFocus"><ArrowsPointingOutIcon data-slot="icon" />Focus</UiButton>
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
          <div class="pt-1">
            <UiButton plain class="text-sm!" title="Something wrong with this chart? Send it over with the details" @click="reportError"><FlagIcon data-slot="icon" />Report a chart error</UiButton>
          </div>
        </div>
  
        <div :class="['relative rounded-xl bg-white p-4 ring-1 ring-note-200 dark:bg-zinc-900 dark:ring-white/10 print:rounded-none print:bg-transparent print:p-0 print:ring-0', focus.on.value && 'mx-auto max-w-6xl print:max-w-none']">
          <div v-if="rendering.busy.value" role="status" aria-label="Loading" class="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-10 print:hidden"><UiSpinner /></div>
          <UiText v-if="editor.fatal.value" class="text-red-600! dark:text-red-400!">Preview paused: the chart is over a size limit.</UiText>
          <ChangesSheet
            v-else-if="sheet === 'changes'"
            :doc="editor.doc.value"
            :title="editor.meta.value.title"
            :subtitle="editor.heading.value.subtitle"
            :composer="editor.heading.value.composer"
            :part="sheetPart"
            :instrument-label="sheetEditor ? '' : instrumentLabel(prefs.instrument.value)"
            :numerals="sheetEditor || prefs.numerals.value"
            :scales="sheetEditor || prefs.scaleNames.value"
            :signatures="signaturesOn"
            :guide-line="prefs.guideLine.value"
            :editable="sheetEditing && !focus.on.value"
            :selected-line="selectedLine"
            :view="scaleView"
            :editing="sheetEditor ? sheetEdit : undefined"
            :preview="sheetPreview"
            @tap="editSheetChord"
            @edit="openSheetEdit"
            @update:doc="editor.setDoc"
            @said="said = $event"
            @preview="sheetPreview = $event"
            @done="sheetDone"
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
            :home-key="homeKey"
            :resolved="resolved"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowsPointingOutIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, BookmarkIcon, CodeBracketIcon, DocumentDuplicateIcon, EllipsisHorizontalIcon, FlagIcon, LinkIcon, PencilSquareIcon, PrinterIcon, XMarkIcon } from '@heroicons/vue/16/solid'
import { ISSUE_CONTEXT, issuePart } from '~/utils/issueReport'
import { CHART_REPORT_KEY, type ChartReport, guidesText } from '~/utils/chartReport'
import {
  buildSheet,
  chartKeyOf,
  type ChartDoc,
  type ChordPreview,
  CONCERT,
  type Part,
  encodeShare,
  instrumentLabel,
  LEVEL_LABELS,
  parseChart,
  LIMITS,
  litKeys,
  type Mode,
  partFor,
  practiceBoxes,
  resolveScales,
  SCALE_LEVELS,
  type LevelState,
  type ScaleView,
  serializeChart,
  setMeta,
  type ShareView,
  unlevel,
} from '@chord-scale-maker/engine'
import type { SaveTarget } from '~/composables/useSavedChart'
import { nextChordLine, type SheetChordEdit, type SheetEdit } from '~/utils/sheetChordEdit'
import { SCALE_VIEW } from '~/utils/scaleView'
import { firstSheet, type SheetKind } from '~/utils/sheets'

/**
 * practiceKey: what practice selections are remembered under (a library slug, or mine:<id>); none for the visit only.
 * saveTarget: where edits save (My charts); none when the feature is off. libraryTitle: the library chart's title.
 * shared: opened from a share link, with the view it carried (applied for this visit, not saved).
 */
const props = defineProps<{ initialText: string; practiceKey?: string; saveTarget?: SaveTarget; libraryTitle?: string; shared?: ShareView; isNew?: boolean }>()
const emit = defineEmits<{ created: [id: string]; reload: [] }>()

const PER_PAGE = 12

/** the level is a view preference: a blank cell plays the analysis at it, and nothing is written */
const scaleLevel = useScaleLevel(props.practiceKey, props.shared)
/** the library chart this one came from (itself, or the source of a copy): its own scale choices are its Standard */
const baseline = ((): ChartDoc | undefined => {
  const t = props.saveTarget
  const slug = t?.kind === 'library' ? t.slug : t?.kind === 'mine' ? loadChart(t.id)?.meta.basedOn : t?.kind === 'new' ? t.basedOn : undefined
  const text = slug ? findChart(slug)?.text : undefined
  return text === undefined ? undefined : parseChart(text).value
})()
const levelState = (): LevelState => ({ level: scaleLevel.level.value, seed: scaleLevel.seed.value, ...(scaleLevel.owned.value ? { owned: scaleLevel.owned.value } : {}) })
/**
 * the migration (docs/superpowers/specs/2026-10-11-proposed-scales-design.md §3): a saved chart a level once wrote
 * its scales into has those cells blank again, so they follow the level; once, as it opens, then the rows it owned
 * are forgotten. A scale you chose stays.
 */
const openingText = ((): string => {
  if (!scaleLevel.owned.value) return props.initialText
  const { doc, blanked } = unlevel(parseChart(props.initialText).value, levelState(), baseline)
  scaleLevel.owned.value = undefined
  if (!blanked) return props.initialText
  console.info(`Scale level: ${blanked === 1 ? '1 scale' : `${blanked} scales`} a level wrote into this chart now follow the level`)
  return serializeChart(doc)
})()

const editor = useChartEditor(openingText)
const chartHistory = useChartHistory(editor)
const rendering = useRendering()
/** under the heading: "Ballad · E♭ · AABA, 32 bars — Johnny Green" */
const byline = computed(() => [editor.heading.value.subtitle, editor.heading.value.composer].filter(Boolean).join(' — '))
const prefs = props.shared ? linkPreferences(props.shared) : usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
/** the editor: hidden by default (song-first), shown for a new chart or one over a size limit (only the text can fix it) */
const bornNew = ref(false) // latches true for a new chart, so saving it (its URL becomes ?mine) doesn't hide the editor mid-edit
watch(() => props.isNew, (v) => { if (v) bornNew.value = true }, { immediate: true })
const editorShown = computed(() => prefs.showEditor.value || bornNew.value || editor.fatal.value)
/** Edit and Done; Done closes a new chart's editor too */
function toggleEditor(): void {
  prefs.showEditor.value = !editorShown.value
  bornNew.value = false
}
/** one spelling at a time: every scale from the Start on note, or each from its own root */
const mode = ref<Mode>(props.shared?.mode ?? 'root')
const sheet = ref<SheetKind>(firstSheet(props.shared?.sheet, { changes: useFeature('changes') }))
const practiceOn = useFeature('practice')
const functionsOn = useFeature('functions')
const signaturesOn = useFeature('keySignatures')
/** chords on the Changes sheet open the chord editor while the editor is shown (on a phone, the whole editor) */
const sheetEditing = computed(() => editorShown.value && !editor.fatal.value)
const sheetChord = ref<SheetChordEdit | null>(null)
const selectedLine = ref<number | null>(null)
const said = ref('')
const barEditor = ref<{ selectLine: (line: number) => void } | null>(null)
/** a chord tapped on the sheet: edit it, and select it in the bar grid */
function editSheetChord(chord: SheetChordEdit): void {
  editor.flush()
  sheetChord.value = chord
  barEditor.value?.selectLine(chord.line)
}
/** the bar editor's Source: under ⋯, remembered; always shown for a chart over a size limit (only the text can fix it) */
const sourceShown = computed(() => prefs.source.value || editor.fatal.value)
/** the chart's key, for the sheets' key signature, drawn once at the start (undefined when the flag is off: drawn as before) */
const homeKey = computed(() => (signaturesOn ? chartKeyOf(editor.doc.value) : undefined))
const practice = usePractice(props.practiceKey)
const LEVEL_OPTIONS = SCALE_LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }))
const levelLabel = (v: (typeof SCALE_LEVELS)[number]): string => LEVEL_LABELS[v]
/** what the sheets and the grid play a blank cell at; one resolution per revision, shared by the Scales sheet and practice */
const scaleView = computed((): ScaleView => ({ level: scaleLevel.level.value, seed: scaleLevel.seed.value }))
provide(SCALE_VIEW, scaleView)
const resolved = computed(() => resolveScales(editor.doc.value, scaleView.value))

if (props.shared?.practice) practice.setSelection(mode.value, props.shared.practice)
const selection = computed(() => (practiceOn ? practice.selection(mode.value) : null))
// every staff with its practice keys, for the panel's boxes and what the selection lights
const practiceStaves = computed(() =>
  practiceOn ? buildSheet(editor.rows.value, part.value, mode.value, prefs.start.value, LIMITS.maxExpandedRows, selection.value, undefined, resolved.value).flatMap((p) => p.pages.flat()) : [],
)
const practiceBoxesNow = computed(() => practiceBoxes(practiceStaves.value, mode.value, prefs.start.value))
const litNow = computed(() => litKeys(practiceStaves.value))
const transposed = ref('')
const focus = useFocusMode()
const focusBar = ref<HTMLElement | null>(null)
/**
 * the lead-sheet editor (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md): the sheet itself is the editor
 * when the flag is on, from md up, while the editor is open on a chart the sheet can draw, outside focus mode. It
 * shows concert pitch (D2) with numerals and scales on (D3): they are the pickers.
 */
const leadSheetOn = useFeature('leadSheetEditor')
const wide = useMediaQuery('(min-width: 768px)')
const sheetEditor = computed(() => leadSheetOn && wide.value && sheetEditing.value && !focus.on.value)
const sheetEdit = ref<SheetEdit | null>(null)
const sheetPreview = ref<ChordPreview | null>(null)
/** the part the sheet draws while editing: the instrument's clef and range, in concert pitch */
const sheetPart = computed((): Part => (sheetEditor.value ? { ...part.value, trans: CONCERT.trans } : part.value))
const concertNote = computed(() =>
  sheetEditor.value && part.value.trans !== 'C' ? `Concert pitch while you edit · your ${instrumentLabel(prefs.instrument.value)} part comes back when you’re done` : '',
)
watch(sheetEditor, (on) => {
  if (!on) sheetEdit.value = null
})
function openSheetEdit(e: SheetEdit): void {
  editor.flush()
  sheetEdit.value = e
  if (e.kind === 'chord') {
    selectedLine.value = e.line
    barEditor.value?.selectLine(e.line)
  }
}
/** the field closed: stay on the chord, move to the next (previous) bar's, open the new chord slot, or nothing */
function sheetDone(then: 'stay' | 'next' | 'prev' | 'add' | 'cancel'): void {
  const e = sheetEdit.value
  sheetPreview.value = null
  if (!e) return
  if (then === 'add') {
    const l = e.kind === 'chord' ? editor.doc.value.lines[e.line] : null
    const at = l?.kind === 'row' ? { section: l.section, bar: l.bar } : e.kind === 'slot' ? { section: e.section, bar: e.bar } : null
    sheetEdit.value = at ? { kind: 'slot', ...at } : null
    return
  }
  if ((then === 'next' || then === 'prev') && e.kind === 'chord') {
    const line = nextChordLine(editor.doc.value, e.line, then)
    sheetEdit.value = line === null ? null : { kind: 'chord', line }
    if (line !== null) selectedLine.value = line
    return
  }
  sheetEdit.value = null
}

const saved = props.saveTarget ? useSavedChart(editor.text, props.saveTarget, (id) => emit('created', id)) : null
if (openingText !== props.initialText) saved?.saveNow()
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

/** edits not saved yet: the autosave is waiting, or failed and will try again; a shared chart is never saved */
const unsaved = computed(() => !editor.fatal.value && (props.shared ? true : ['pending', 'failed'].includes(saved?.status.value.state ?? '')))

/** the Save beside Undo: the autosave's wait skipped; a shared chart kept in My charts */
function saveNow(): void {
  if (props.shared) return saveShared()
  editor.flush()
  saved?.flush()
}

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
async function shareUrl(): Promise<string> {
  editor.flush()
  saved?.flush()
  const view: ShareView = {
    instrument: prefs.instrument.value,
    mode: mode.value,
    start: prefs.start.value,
    intervals: prefs.intervals.value,
    numerals: prefs.numerals.value,
    scaleNames: prefs.scaleNames.value,
    ...(prefs.guideLine.value !== 'off' ? { guideLine: prefs.guideLine.value } : {}), // absent: off
    sheet: sheet.value,
    ...(selection.value ? { practice: selection.value } : {}),
    ...(scaleLevel.level.value !== 'standard' ? { level: scaleLevel.level.value, seed: scaleLevel.seed.value } : {}),
  }
  return `${location.origin}/song#s=${await encodeShare({ chart: editor.text.value, view })}`
}

async function openShare(): Promise<void> {
  shareLink.value = null
  shareOpen.value = true
  shareLink.value = await shareUrl()
}

/** the library chart's slug while the chart is that chart as published: a report names it by slug and bar, no share link */
const publishedSlug = (): string | null => {
  const t = props.saveTarget
  return t?.kind === 'library' && editor.text.value === t.libraryText ? t.slug : null
}
provide(ISSUE_CONTEXT, { title: () => editor.heading.value.title, part: () => issuePart(prefs.instrument.value), library: publishedSlug, shareUrl })

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

/** send the chart and its context to the contact form (via sessionStorage), pre-filled for a bug report */
function reportError(): void {
  editor.flush()
  const report: ChartReport = {
    chart: editor.text.value,
    slug: props.saveTarget && 'slug' in props.saveTarget ? props.saveTarget.slug : '',
    title: editor.heading.value.title,
    version: String(useRuntimeConfig().public.version ?? ''),
    instrument: instrumentOption(prefs.instrument.value),
    sheet: sheet.value,
    guides: guidesText(prefs.guideLine.value),
    level: scaleLevel.level.value,
    url: location.href,
  }
  sessionStorage.setItem(CHART_REPORT_KEY, JSON.stringify(report))
  navigateTo('/contact')
}
</script>
