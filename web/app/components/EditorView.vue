<template>
  <div class="space-y-10">
    <!-- the sheet's own heading is the page's (SheetPages), its save status under it; the actions are in the rail -->
    <UiText v-if="sheetEditing" class="md:hidden print:hidden">Full editing works on a larger screen. Tap a chord on the sheet to change it.</UiText>

    <ShareDialog :open="shareOpen" :link="shareLink" @close="shareOpen = false" />
    <SheetChordEditor :doc="editor.doc.value" :target="sheetChord" @update:doc="editor.setDoc" @said="said = $event" @close="sheetChord = null" />
    <!-- the sheet editor's structure dialogs: a new section, a section from a bar, a jump, pasted bars, a repeat, a rename -->
    <BarDialog
      :kind="sheetDialog?.kind ?? null"
      :sections="sheetSections"
      :section="sheetDialog?.section ?? ''"
      :bar="sheetDialog?.bar ?? 0"
      :beats="sheetBeats"
      :error="sheetDialogError"
      :nav="sheetDialog?.nav"
      @close="sheetDialog = null"
      @submit="applySheetDialog"
    />
    <p class="sr-only" aria-live="polite">{{ said }}</p>

    <UiDialog :open="revertOpen" size="md" @close="revertOpen = false">
      <UiDialogTitle>Revert to the library version?</UiDialogTitle>
      <UiDialogDescription>Your edits to {{ libraryTitle }} are removed from this browser. To keep them as well, Save as a copy first.</UiDialogDescription>
      <UiDialogActions>
        <UiButton plain @click="revertOpen = false">Cancel</UiButton>
        <UiButton color="note" @click="revert">Revert</UiButton>
      </UiDialogActions>
    </UiDialog>

    <!-- the working area, on the stand (the song page's layout keeps its muted text at AA contrast) -->
    <div class="space-y-4">
      <UiText v-if="!editorShown && editor.diagnostics.value.length" role="status" class="text-amber-800! print:hidden dark:text-amber-400!">
        The chart's text has {{ editor.diagnostics.value.length === 1 ? 'a problem' : `${editor.diagnostics.value.length} problems` }}.
        <button type="button" class="font-semibold underline" @click="toggleEditor">Edit</button> to fix {{ editor.diagnostics.value.length === 1 ? 'it' : 'them' }}.
      </UiText>
  
      <!-- the Chart pane: the heading fields, Undo/Redo/Save, and the text under ⋯ as the Source. From md up the sheet
           is the editor and this pane is not rendered: it stays below md (the heading fields and the phone note) and
           on a chart over a size limit (the notice, and the Source) -->
      <div v-if="editorShown" class="space-y-8 print:hidden" @keydown="chartHistory.onKeydown">
        <section v-if="!sheetEditor" aria-labelledby="grid-heading" class="min-w-0 space-y-5">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <UiSubheading id="grid-heading">Chart</UiSubheading>
            <UiBadge color="zinc" title="The chart is written and edited in concert pitch, whatever the instrument">Concert pitch</UiBadge>
            <div class="ml-auto flex flex-wrap items-center justify-end gap-1">
              <UiButton plain :disabled="!chartHistory.canUndo.value" title="Undo (⌘Z)" @click="chartHistory.undo"><ArrowUturnLeftIcon data-slot="icon" />Undo</UiButton>
              <UiButton plain :disabled="!chartHistory.canRedo.value" title="Redo (⇧⌘Z)" @click="chartHistory.redo"><ArrowUturnRightIcon data-slot="icon" />Redo</UiButton>
              <UiButton v-if="saved || shared" plain :disabled="!unsaved" title="Save in this browser now (edits also save a moment after you stop)" @click="saveNow"><BookmarkIcon data-slot="icon" />Save</UiButton>
              <UiDropdown v-if="sourceOffered">
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
          <!-- below md, light edits only: the heading fields here, chords on the Changes sheet -->
          <ChartHeadingFields v-else :doc="editor.doc.value" @update:doc="editor.setDoc" />
        </section>
        <section v-if="sourceShown" id="text-pane" aria-labelledby="text-heading" class="min-w-0">
          <div class="relative mb-3 flex items-center gap-2">
            <UiSubheading id="text-heading">Source</UiSubheading>
            <HelpTip label="How the text editor works">
              <span class="block">A <code class="font-mono text-xs">section: A</code> line, then one line per chord: <code class="font-mono text-xs whitespace-nowrap">bar | chord | scale | function</code>, its bar counted from 1 in the section, in concert pitch. Leave the scale out to use the chord's default.</span>
              <span class="mt-2 block"><code class="font-mono text-xs">title:</code>, <code class="font-mono text-xs">subtitle:</code>, <code class="font-mono text-xs">composer:</code>, <code class="font-mono text-xs">key:</code> and <code class="font-mono text-xs">form:</code> at the top set the heading, and lines starting with <code class="font-mono text-xs">#</code> are comments. Under a section line, <code class="font-mono text-xs">copy: A</code> repeats section A, <code class="font-mono text-xs">key: D</code> puts the section in D, and <code class="font-mono text-xs">@key 5 D</code> from its bar 5.</span>
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
          focus.on.value && 'fixed inset-0 z-50 overflow-y-auto bg-stand px-4 pb-8 print:static print:overflow-visible print:bg-white print:p-0',
        ]"
      >
        <div v-if="focus.on.value" ref="focusBar" class="sticky top-0 z-10 -mx-4 flex justify-end bg-stand/90 px-4 py-3 backdrop-blur-sm print:hidden">
          <UiButton outline @click="focus.exit"><XMarkIcon data-slot="icon" />Exit focus<kbd class="ml-1 font-sans text-xs text-zinc-500 dark:text-zinc-400">Esc</kbd></UiButton>
        </div>
        <!-- display: contents, so the rail inside sticks over the whole section (the paper's top margin stands in for this
             box's own, which a contents box doesn't have) -->
        <div v-show="!focus.on.value" class="contents space-y-4 print:hidden">
          <!-- the sheet is the editor (from md up): a banner says so, in concert pitch, with Undo, Redo, Source, Save and Done editing -->
          <div v-if="sheetEditor" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-note-800 px-4 py-2 text-sm text-white dark:bg-note-900">
            <span class="font-semibold">Editing the sheet</span>
            <span v-if="concertNote" class="text-note-100">{{ concertNote }}</span>
            <span class="flex items-center gap-2">
              <UiButton plain class="text-white! hover:bg-white/10!" :disabled="!chartHistory.canUndo.value" aria-label="Undo the last change" title="Undo (⌘Z)" @click="chartHistory.undo"><ArrowUturnLeftIcon data-slot="icon" class="text-white!" />Undo</UiButton>
              <UiButton plain class="text-white! hover:bg-white/10!" :disabled="!chartHistory.canRedo.value" aria-label="Redo the last change" title="Redo (⇧⌘Z)" @click="chartHistory.redo"><ArrowUturnRightIcon data-slot="icon" class="text-white!" />Redo</UiButton>
              <UiButton v-if="sourceOffered" plain class="text-white! hover:bg-white/10!" :aria-pressed="sourceShown" title="Show or hide the chart's text" @click="prefs.source.value = !sourceShown"><CodeBracketIcon data-slot="icon" class="text-white!" />Source</UiButton>
              <UiButton v-if="saved || shared" plain class="text-white! hover:bg-white/10!" :disabled="!unsaved" title="Save in this browser now (edits also save a moment after you stop)" @click="saveNow"><BookmarkIcon data-slot="icon" class="text-white!" />Save</UiButton>
              <UiButton color="white" @click="toggleEditor">Done editing</UiButton>
            </span>
          </div>
          <PreviewControls
            v-model:sheet="sheet"
            v-model:instrument="prefs.instrument.value"
            v-model:range="prefs.range.value"
            v-model:spell="prefs.spell.value"
            v-model:intervals="prefs.intervals.value"
            v-model:numerals="prefs.numerals.value"
            v-model:scale-names="prefs.scaleNames.value"
            v-model:overlay="prefs.overlay.value"
            v-model:pent-rung="prefs.pentRung.value"
            v-model:pent-side="prefs.pentSide.value"
            v-model:pent-basis="prefs.pentBasis.value"
            v-model:pent-degree="prefs.pentDegree.value"
            v-model:pent-path="pentPathModel"
            v-model:pent-step-unit="pentStepUnit"
            v-model:pent-step-bars="pentStepBars"
            v-model:line-mode="prefs.lineMode.value"
            v-model:guide-line="prefs.guideLine.value"
            v-model:approach="prefs.approach.value"
            v-model:arpeggio="prefs.arpeggio.value"
            v-model:cells="prefs.cells.value"
            v-model:arp-notes="prefs.arpNotes.value"
            v-model:arp-dir="prefs.arpDir.value"
            v-model:pattern="prefs.pattern.value"
            v-model:pattern-notes="prefs.patternNotes.value"
            v-model:pattern-dir="prefs.patternDir.value"
            v-model:pent-leave="prefs.pentLeave.value"
            :key-start="keyStartNote"
            :lock-labels="sheetEditor"
            :compact="compactRail"
            :sticky-rail="sheetEditing"
          >
            <!-- Level: how sophisticated each chord's scale is (engine/src/levels.ts); a dropdown in the toolbar -->
            <template v-if="!editor.fatal.value" #level>
              <UiListbox :model-value="scaleLevel.level.value" class="w-32" @update:model-value="(v) => v && (scaleLevel.level.value = v)">
                <template #selected="{ value }"><UiListboxLabel>{{ levelLabel(value) }}</UiListboxLabel></template>
                <UiListboxOption v-for="o in LEVEL_OPTIONS" :key="o.value" :value="o.value"><UiListboxLabel>{{ o.label }}</UiListboxLabel></UiListboxOption>
              </UiListbox>
              <UiButton v-if="scaleLevel.level.value === 'random'" outline aria-label="Shuffle" title="Deal a new random scale for each chord" @click="scaleLevel.shuffle"><ArrowPathIcon data-slot="icon" /></UiButton>
            </template>
            <template v-if="!editor.fatal.value" #transpose>
              <ChartTranspose :current="currentDoc" @update:doc="onTransposed" @transposed="transposed = $event" />
            </template>
            <!-- the actions: Edit, Share, Focus, Print (the view's one primary), the rest under More; on a phone (compact)
                 Edit, Share and Focus are in the Controls dialog -->
            <template #actions="{ place, after }">
              <!-- Edit: in the rail, or on a phone in the dialog, but in the rail while editing (its Done the way out) -->
              <ToggleButton v-if="!editor.fatal.value && (place === 'rail') === (!compactRail || editorShown)" :model-value="editorShown" expands title="Show or hide the chart editor" @update:model-value="toggleEditor"><PencilSquareIcon data-slot="icon" />{{ editorShown ? 'Done' : 'Edit' }}</ToggleButton>
              <template v-if="place === 'dialog' || !compactRail">
                <UiButton v-if="shared" outline :disabled="editor.fatal.value" @click="saveShared"><BookmarkIcon data-slot="icon" />Save to My charts</UiButton>
                <UiButton outline :disabled="editor.fatal.value" @click="after(openShare)"><LinkIcon data-slot="icon" />Share</UiButton>
                <UiButton v-if="!editor.fatal.value" outline title="Show only the sheet music (Esc to leave)" @click="after(enterFocus)"><ArrowsPointingOutIcon data-slot="icon" />Focus</UiButton>
              </template>
              <template v-if="place === 'rail'">
                <UiButton v-if="!editor.fatal.value" color="note" title="Print, or save a PDF from the print dialog" @click="print"><PrinterIcon data-slot="icon" />Print</UiButton>
                <MoreMenu :items="moreItems" @action="onMore" />
              </template>
            </template>
          </PreviewControls>
          <!-- the notice and the Practice panel come and go with options: eased (#297) -->
          <EaseReveal :show="!!hidden" class="mt-4"><InterfaceNotice v-if="hidden" :needs="hidden.needs" @show="ui.level.value = hidden.needs" @reset="resetHidden" /></EaseReveal>
          <UiText v-if="transposed" role="status" class="mt-4">{{ transposed }}</UiText>
          <EaseReveal :show="ui.shows('practice') && sheet === 'scales' && !editor.fatal.value" class="mt-4">
            <PracticePanel
              :mode="mode"
              :start-text="start"
              :boxes="practiceBoxesNow"
              :selection="selection"
              :lit="litNow"
              @update:selection="practice.setSelection(mode, $event)"
            />
          </EaseReveal>
        </div>
  
        <div class="relative mt-4">
          <div v-if="rendering.busy.value" role="status" aria-label="Loading" class="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-10 print:hidden"><UiSpinner /></div>
          <template v-if="editor.fatal.value">
            <UiHeading class="mb-1">{{ editor.meta.value.title || 'Untitled' }}</UiHeading>
            <SheetStatus v-if="statusText || copyError" :text="statusText" :failed="saveFailed" :error="copyError" class="mb-2 print:hidden" />
            <UiText class="text-red-600! dark:text-red-400!">Preview paused: the chart is over a size limit.</UiText>
          </template>
          <ChangesSheet
            v-else-if="sheet === 'changes'"
            :doc="editor.doc.value"
            :title="editor.meta.value.title"
            :heading-level="1"
            :subtitle="editor.heading.value.subtitle"
            :composer="editor.heading.value.composer"
            :part="sheetPart"
            :instrument-label="sheetEditor ? '' : instrumentLabel(prefs.instrument.value)"
            :numerals="showNumerals"
            :scales="showScaleNames"
            :line="changesLine"
            :approach="approachShown"
            :editable="sheetEditing && !focus.on.value"
            :selected-line="selectedLine"
            :view="scaleView"
            :editing="sheetEditor ? sheetEdit : undefined"
            :preview="sheetPreview"
            :focus-at="sheetFocus"
            :overlay="overlayPlan"
            @pick="onPick"
            @tap="editSheetChord"
            @edit="openSheetEdit"
            @update:doc="editor.setDoc"
            @said="said = $event"
            @preview="sheetPreview = $event"
            @done="sheetDone"
            @refused="said = $event"
            @dialog="openSheetDialog"
            @add-bar="sheetAddBar"
            @add-section="openSheetDialog('section', '', 0)"
            @repeat-section="openSheetDialog('repeat', '', 0)"
          >
            <template v-if="!focus.on.value && (statusText || copyError)" #status><SheetStatus :text="statusText" :failed="saveFailed" :error="copyError" /></template>
          </ChangesSheet>
          <ScaleSheet
            v-else-if="sheet === 'scales'"
            :rows="editor.rows.value"
            :title="editor.meta.value.title"
            :heading-level="1"
            :subtitle="editor.heading.value.subtitle"
            :composer="editor.heading.value.composer"
            :part="part"
            :instrument-label="instrumentLabel(prefs.instrument.value)"
            :start="start"
            :mode="mode"
            :per-page="PER_PAGE"
            :intervals="prefs.intervals.value"
            :practice="selection"
            :home-key="homeKey"
            :resolved="resolved"
            :picks="chordPicks.picks.value"
            :positions="positionsNow"
            :pickable="ui.shows('chord-picks')"
            @pick="onPick"
          >
            <template v-if="!focus.on.value && (statusText || copyError)" #status><SheetStatus :text="statusText" :failed="saveFailed" :error="copyError" /></template>
          </ScaleSheet>
          <ArpeggioSheet
            v-else
            :rows="editor.rows.value"
            :title="editor.meta.value.title"
            :heading-level="1"
            :subtitle="editor.heading.value.subtitle"
            :composer="editor.heading.value.composer"
            :part="part"
            :instrument-label="instrumentLabel(prefs.instrument.value)"
            :per-page="PER_PAGE"
            :notes="sheet === 'patterns' ? prefs.patternNotes.value : prefs.arpNotes.value"
            :moves="sheet === 'patterns' ? patternMoves : undefined"
            :dir="sheet === 'patterns' ? prefs.patternDir.value : prefs.arpDir.value"
            :intervals="prefs.intervals.value"
            :home-key="homeKey"
            :resolved="resolved"
          >
            <template v-if="!focus.on.value && (statusText || copyError)" #status><SheetStatus :text="statusText" :failed="saveFailed" :error="copyError" /></template>
          </ArpeggioSheet>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon, ArrowsPointingOutIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, BookmarkIcon, CodeBracketIcon, EllipsisHorizontalIcon, LinkIcon, PencilSquareIcon, PrinterIcon, XMarkIcon } from '@heroicons/vue/16/solid'
import { ISSUE_CONTEXT, issuePart } from '~/utils/issueReport'
import { CHART_REPORT_KEY, type ChartReport, guidesText } from '~/utils/chartReport'
import { approachApplies, changesLineOf, shareLineOf } from '~/utils/sheetLine'
import { type HiddenSetting, hiddenSettings } from '~/utils/interface'
import {
  addSection,
  barView,
  changesSections,
  buildSheet,
  chartKeyOf,
  type ChartDoc,
  chartMeta,
  type ChordAt,
  type ChordPreview,
  chordPositions,
  CONCERT,
  type GridPos,
  type Part,
  encodeShare,
  insertBars,
  drawnChords,
  insertHeldBar,
  keyStart,
  renameSection,
  repeatSection,
  setNav,
  splitSection,
  instrumentLabel,
  LEVEL_LABELS,
  parseChart,
  hasPicks,
  isHexatonicSelection,
  isPentatonicSelection,
  type PickKind,
  pickTargets,
  LIMITS,
  litKeys,
  type Mode,
  parsePattern,
  partFor,
  practiceBoxes,
  resolveScales,
  SCALE_LEVELS,
  type LevelState,
  type OverlayPlan,
  type PentatonicPlan,
  type ScaleView,
  serializeChart,
  setMeta,
  type ShareView,
  unlevel,
  isFatal,
  lineSections,
  migrateChart,
  remapOwned,
} from '@chord-scale-maker/engine'
import BarDialog, { type BarDialogKind, type BarDialogSubmit } from './BarDialog.vue'
import type { SaveTarget } from '~/composables/useSavedChart'
import { nextChordLine, type SheetChordEdit, type SheetDone, type SheetEdit, type SheetFocus, type SheetPlace } from '~/utils/sheetChordEdit'
import { SCALE_VIEW } from '~/utils/scaleView'
import { firstSheet, type SheetKind } from '~/utils/sheets'
import { DEFAULT_PATTERN } from '~/composables/usePreferences'
import { type MoreAction, moreMenuItems } from '~/utils/moreMenu'
import { SHEET_PAGED } from '~/utils/sheetPaged'
import { spellView } from '~/utils/scaleChoices'
import { writeStored } from '~/utils/storage'
import { type AnalyticsEvent, sendEvent, songOf } from '~/utils/analytics'

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
/**
 * what opens: a chart in the retired row format (a saved chart, an old draft, a file from disk) migrated to section
 * blocks (#329), then the Scale-level migration (docs/superpowers/specs/2026-10-11-proposed-scales-design.md §3): a
 * chart a level once wrote its scales into has those cells blank again, so they follow the level; once, as it opens,
 * then the rows it owned are forgotten. A scale you chose stays. Either change is saved back.
 */
const openingText = ((): string => {
  const found = migrateChart(props.initialText)
  // a migration that would take the chart over a limit is left undone: the parser then says what's wrong
  const migrated = found.text !== props.initialText && isFatal(parseChart(found.text).diagnostics) ? { ...found, text: props.initialText } : found
  if (migrated.text !== props.initialText) {
    // the chart as it was, kept in this browser in case the migration misread it (#329)
    if (props.practiceKey) writeStored(`csm-premigration:${props.practiceKey}`, props.initialText)
    if (migrated.problems.length) console.info(`Chart format: ${migrated.problems.join('; ')}`)
  }
  const owned = scaleLevel.owned.value
  if (!owned) return migrated.text
  scaleLevel.owned.value = undefined
  const state: LevelState = { level: scaleLevel.level.value, seed: scaleLevel.seed.value, owned: remapOwned(owned, migrated.lineMap) }
  const { doc, blanked } = unlevel(parseChart(migrated.text).value, state, baseline)
  if (!blanked) return migrated.text
  console.info(`Scale level: ${blanked === 1 ? '1 scale' : `${blanked} scales`} a level wrote into this chart now follow the level`)
  return serializeChart(doc)
})()

const editor = useChartEditor(openingText)
const rendering = useRendering()
/** under the heading: "Ballad · E♭ · AABA, 32 bars — Johnny Green" */
const prefs = props.shared ? linkPreferences(props.shared) : usePreferences()
/** #359: the player's range, behind its flag; the preset's without it */
const playerRange = useFeature('playerRange')
const part = computed(() => partFor(prefs.instrument.value, playerRange ? prefs.range.value : undefined))
/** the editor: hidden by default (song-first), shown for a new chart or one over a size limit (only the text can fix it) */
const bornNew = ref(false) // latches true for a new chart, so saving it (its URL becomes ?mine) doesn't hide the editor mid-edit
watch(() => props.isNew, (v) => { if (v) bornNew.value = true }, { immediate: true })
const editorShown = computed(() => prefs.showEditor.value || bornNew.value || editor.fatal.value)
/** Edit and Done; Done closes a new chart's editor too */
function toggleEditor(): void {
  prefs.showEditor.value = !editorShown.value
  bornNew.value = false
}
/** one spelling at a time: every scale from the chart's key (written for the part) or a picked note, or each from its own root */
const keyStartNote = computed(() => keyStart(chartKeyOf(editor.doc.value), part.value))
const spelled = computed(() => spellView(prefs.spell.value, keyStartNote.value))
const mode = computed((): Mode => spelled.value.mode)
const start = computed(() => spelled.value.start)
const sheet = ref<SheetKind>(firstSheet(props.shared?.sheet, useFeature('patterns')))
/** the Interface level (#273): which controls show */
const ui = useInterface()
/** the chart's sections as the Changes sheet draws them, for the path presets (#264) */
const pentSections = computed(() => changesSections(editor.doc.value))
const pentPath = usePentatonicPath(props.practiceKey, pentSections, computed(() => ({ rung: prefs.pentRung.value, side: prefs.pentSide.value })))
const pentPathModel = computed({ get: () => pentPath.path.value, set: (v) => pentPath.setPath(v) })
const pentStepUnit = computed({ get: () => pentPath.step.value.unit, set: (unit) => pentPath.setStep({ ...pentPath.step.value, unit }) })
const pentStepBars = computed({ get: () => pentPath.step.value.bars, set: (bars) => pentPath.setStep({ ...pentPath.step.value, bars }) })
/** what the sheets and the grid play a blank cell at; one resolution per revision, shared by the Scales sheet and practice */
const scaleView = computed((): ScaleView => ({ level: scaleLevel.level.value, seed: scaleLevel.seed.value }))
provide(SCALE_VIEW, scaleView)
const resolved = computed(() => resolveScales(editor.doc.value, scaleView.value))
/** the chord picks (#272, #303): one set for both sheets, matched to what each drawn chord plays now */
const pickTargetsNow = computed(() => pickTargets(editor.doc.value, resolved.value))
const positionsNow = computed(() => chordPositions(editor.doc.value))
const chordPicks = useChordPicks(props.practiceKey, pickTargetsNow, props.shared?.picks)
/** the sheet's Pentatonic overlay plan; null under another overlay or none */
const pentatonicPlan = computed((): PentatonicPlan | null => (prefs.overlay.value === 'pentatonic'
  ? { ...pentPath.plan.value, basis: prefs.pentBasis.value, degree: prefs.pentDegree.value, picks: chordPicks.picks.value.pentatonic } // the Changes sheet ignores stale picks by their for
  : null))
const hexatonicPlan = computed((): OverlayPlan => ({ kind: 'hexatonic', picks: chordPicks.picks.value.hexatonic }))
const overlayPlan = computed((): OverlayPlan | null => (prefs.overlay.value === 'hexatonic' ? hexatonicPlan.value : pentatonicPlan.value))
/** a popover's pick (concert) for its chords on either sheet; null: back to the sheet's choice */
function onPick(kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null): void {
  if (value === null) chordPicks.clear(kind, positions)
  else if (kind === 'pentatonic' && typeof value === 'number') chordPicks.pick('pentatonic', positions, value)
  else if (kind === 'hexatonic' && typeof value !== 'number') chordPicks.pick('hexatonic', positions, value)
}
/** the stored pattern's moves (the text is canonical; an unparseable one draws as the default pattern rather than nothing) */
const patternMoves = computed(() => {
  const p = parsePattern(prefs.pattern.value)
  if ('moves' in p) return p.moves
  const fallback = parsePattern(DEFAULT_PATTERN)
  return 'moves' in fallback ? fallback.moves : []
})
const sheetLine = computed(() => shareLineOf(prefs.lineMode.value, prefs.guideLine.value, prefs.arpeggio.value, prefs.cells.value))
/** the line the Changes sheet draws: the stored one, the arpeggio slot read as the Pentatonic line under the Pentatonic overlay (#284) */
const changesLine = computed(() => changesLineOf({ mode: prefs.lineMode.value, guide: prefs.guideLine.value, arpeggio: prefs.arpeggio.value, overlay: prefs.overlay.value, leave: prefs.pentLeave.value, dir: prefs.arpDir.value, cells: prefs.cells.value }))
/** chords on the Changes sheet open the chord editor while the editor is shown (on a phone, the whole editor) */
const sheetEditing = computed(() => editorShown.value && !editor.fatal.value)
const sheetChord = ref<SheetChordEdit | null>(null)
const selectedLine = ref<number | null>(null)
const said = ref('')
/** a chord tapped on the sheet below md: edit it in the chord editor's bottom sheet */
function editSheetChord(chord: SheetChordEdit): void {
  editor.flush()
  sheetChord.value = chord
}
/** the Source: in the banner, or under ⋯ below md, remembered; always shown for a chart over a size limit (only the text can fix it) */
/** the Source is offered from Everything, and at any level while the text has a problem (only the text can fix it) */
const sourceOffered = computed(() => ui.shows('source') || editor.diagnostics.value.length > 0)
const sourceShown = computed(() => (sourceOffered.value && prefs.source.value) || editor.fatal.value)
/** the chart's key, for the sheets' key signature, drawn once at the start */
const homeKey = computed(() => chartKeyOf(editor.doc.value))
const practice = usePractice(props.practiceKey)
const LEVEL_OPTIONS = SCALE_LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }))
const levelLabel = (v: (typeof SCALE_LEVELS)[number]): string => LEVEL_LABELS[v]

if (props.shared?.practice) practice.setSelection(mode.value, props.shared.practice)
const selection = computed(() => practice.selection(mode.value))
/** ⌘Z and ⇧⌘Z (#315): the chart's text and its note choices, one history for both sheets; view preferences stay out */
const chartHistory = useChartHistory(editor, {
  picks: choice(() => chordPicks.picks.value, chordPicks.set),
  pentPath: choice(() => pentPath.state.value, pentPath.setState),
  pentRung: refChoice(prefs.pentRung),
  pentSide: refChoice(prefs.pentSide),
  pentBasis: refChoice(prefs.pentBasis),
  pentDegree: refChoice(prefs.pentDegree),
  practiceRoot: choice(() => practice.selection('root'), (s) => practice.setSelection('root', s)),
  practiceFrom: choice(() => practice.selection('from'), (s) => practice.setSelection('from', s)),
}, props.practiceKey)
// picks survive Built on, Path, Step, Rung, Side and Ranked against; a transposed chart: a legacy pick has no for to catch it.
// An undo sets its own picks back with the text, so neither runs then.
watch(() => JSON.stringify(chartKeyOf(editor.doc.value)), () => { if (!chartHistory.restoring.value) chordPicks.clearAll() })
watch(() => editor.doc.value, (doc, old) => { if (!chartHistory.restoring.value && hasPicks(chordPicks.picks.value)) chordPicks.carry(drawnChords(old), drawnChords(doc)) }) // a bar in or out moves later chords' keys (#275)
// every staff with its practice keys, for the panel's boxes and what the selection lights
const practiceStaves = computed(() =>
  buildSheet(editor.rows.value, part.value, mode.value, start.value, LIMITS.maxExpandedRows, selection.value, undefined, resolved.value, { picks: chordPicks.picks.value, at: positionsNow.value }).flatMap((p) => p.pages.flat()),
)
const practiceBoxesNow = computed(() => practiceBoxes(practiceStaves.value, mode.value, start.value))
const litNow = computed(() => litKeys(practiceStaves.value))
const transposed = ref('')
/** live chord picks of the kind the sheet shows: the Changes sheet's overlay, the Scales sheet's practice preset */
const picksInForce = computed((): boolean => {
  const s = selection.value
  const kind: PickKind | null = sheet.value === 'changes'
    ? (prefs.overlay.value === 'off' ? null : prefs.overlay.value)
    : sheet.value === 'scales' && s ? (isPentatonicSelection(s) ? 'pentatonic' : isHexatonicSelection(s) ? 'hexatonic' : null) : null
  return kind !== null && hasPicks(chordPicks.live.value, kind)
})
/** the Approach the sheet plays: none where the line takes none (approachApplies, #381) */
const approachShown = computed(() => (approachApplies(prefs.lineMode.value, prefs.overlay.value) ? prefs.approach.value : 'none'))
/** settings in force whose controls this Interface level hides (a share link, a stored preference): the notice offers to show them or reset them */
const hidden = computed(() =>
  hiddenSettings(ui.level.value, { sheet: sheet.value, scaleLevel: scaleLevel.level.value, numerals: showNumerals.value, scaleNames: showScaleNames.value, lineMode: prefs.lineMode.value, spell: prefs.spell.value, practice: selection.value, overlay: prefs.overlay.value, picks: picksInForce.value, approach: approachShown.value }),
)
/** each reset, given the mode in force before any of them ran (resetting the spelling changes the mode) */
const RESETS: Readonly<Record<HiddenSetting, (inForce: Mode) => void>> = {
  'scale-level': () => (scaleLevel.level.value = 'standard'),
  numerals: () => (prefs.numerals.value = true),
  'scale-names': () => (prefs.scaleNames.value = true),
  line: () => (prefs.lineMode.value = 'off'),
  approaches: () => (prefs.approach.value = 'none'),
  spell: () => (prefs.spell.value = 'key'),
  practice: (inForce) => practice.setSelection(inForce, null),
  pentatonics: () => {
    prefs.overlay.value = 'off'
    pentPath.reset() // this chart's stored path too; other charts' are their own settings (#291)
  },
  'chord-picks': () => chordPicks.clearAll(),
  patterns: () => (sheet.value = 'changes'),
}
function resetHidden(): void {
  const inForce = mode.value
  for (const s of hidden.value?.settings ?? []) RESETS[s](inForce)
}
const focus = useFocusMode()
const focusBar = ref<HTMLElement | null>(null)
/**
 * the lead-sheet editor (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md): the sheet itself is the editor
 * from md up, while the editor is open on a chart the sheet can draw, outside focus mode. It shows concert pitch (D2)
 * with numerals and scales on (D3): they are the pickers.
 */
// this view is client-only: start from the real width, so a phone's first paint already has the compact rail
const WIDE = '(min-width: 768px)'
// focus mode shows the sheet as pages fitted to the window (SheetPages)
provide(SHEET_PAGED, focus.on)
const wide = useMediaQuery(WIDE, import.meta.client ? window.matchMedia(WIDE).matches : true)
/** phones: the short rail, its other controls in a dialog */
const compactRail = computed(() => !wide.value)
const sheetEditor = computed(() => wide.value && sheetEditing.value && !focus.on.value)
/** numerals and scales as the sheet draws them: the editor forces both on (D3), so they don't count toward the notice while it's open (#291) */
const showNumerals = computed(() => sheetEditor.value || prefs.numerals.value)
const showScaleNames = computed(() => sheetEditor.value || prefs.scaleNames.value)
const sheetEdit = ref<SheetEdit | null>(null)
const sheetPreview = ref<ChordPreview | null>(null)
/** a chord the sheet should give focus to (its field closed by a key with nowhere to go) */
const sheetFocus = ref<SheetFocus | null>(null)
/** ⌘Z and ⇧⌘Z anywhere on the page (#315); a text field keeps its own undo (the editor's pane takes its own first) */
function onPageKeydown(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null
  if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return
  chartHistory.onKeydown(e)
}
onMounted(() => window.addEventListener('keydown', onPageKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onPageKeydown))
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
  if (e.kind === 'chord') selectedLine.value = e.line
}
/**
 * the field closed: stay on the chord, move to the next (previous) bar's or chord, open the new chord slot, or nothing.
 * A chord taken out (blank) comes with its place: its line is gone, or names the chord after it, so moves go from there.
 */
function sheetDone(then: SheetDone, taken?: GridPos): void {
  const e = sheetEdit.value
  sheetPreview.value = null
  if (!e) return
  const doc = editor.doc.value
  const sections = lineSections(doc)
  /** a row's place as written */
  const writtenAt = (line: number): SheetPlace | null => {
    const l = doc.lines[line]
    const section = sections[line]
    return l?.kind === 'row' && section ? { section, bar: l.bar } : null
  }
  // the chord the field was on: a slot's is the bar's last row (the chord it added, or the one before it)
  const line = e.kind === 'chord' ? e.line : doc.lines.findLastIndex((l, i) => l.kind === 'row' && sections[i] === e.section && l.bar === e.bar)
  const at = e.kind === 'chord' ? e.at : { section: e.section, bar: e.bar }
  if (line < 0) return void (sheetEdit.value = null)
  if (then === 'add' && !taken) {
    const slotAt = writtenAt(line)
    sheetEdit.value = slotAt ? { kind: 'slot', ...slotAt } : null
    return
  }
  const move = MOVES[then]
  if (move) {
    const to = nextChordLine(doc, taken ?? line, move.dir, move.step)
    const toAt = to === null ? null : writtenAt(to)
    if (to !== null && toAt) {
      sheetEdit.value = { kind: 'chord', line: to, at: toAt }
      selectedLine.value = to
      return
    }
  }
  sheetEdit.value = null
  // focus back on the chord's button; one taken out gives it to the chord now in its place, or the one before
  const stay = taken ? (nextChordLine(doc, taken, 'next', 'chord') ?? nextChordLine(doc, taken, 'prev', 'chord')) : line
  const stayAt = taken ? (stay === null ? null : writtenAt(stay)) : at
  if (stay !== null && stayAt) sheetFocus.value = { line: stay, at: stayAt, n: (sheetFocus.value?.n ?? 0) + 1 }
}

/** how each closing key moves the field: Tab and ⇧Tab by bars, → and ← by chords */
const MOVES: Partial<Record<SheetDone, Readonly<{ dir: 'next' | 'prev'; step: 'bar' | 'chord' }>>> = {
  next: { dir: 'next', step: 'bar' },
  prev: { dir: 'prev', step: 'bar' },
  nextChord: { dir: 'next', step: 'chord' },
  prevChord: { dir: 'prev', step: 'chord' },
}

/** the sheet editor's structure actions (spec §1.4): the toolbar's and the ghost bar's, by the engine's edits */
const sheetView = computed(() => barView(editor.doc.value))
const sheetSections = computed(() => sheetView.value.sections.filter((x) => !x.copy).map((x) => x.name))
const sheetBeats = computed(() => sheetView.value.beats)
const sheetDialog = ref<{ kind: BarDialogKind; section: string; bar: number; nav?: string } | null>(null)
const sheetDialogError = ref('')
function openSheetDialog(kind: BarDialogKind, section: string, bar: number): void {
  const cell = sheetView.value.sections.find((s) => s.name === section)?.bars.find((b) => b.bar === bar)
  sheetDialog.value = { kind, section, bar, ...(kind === 'nav' ? { nav: cell?.nav[0]?.text ?? '' } : {}) }
  sheetDialogError.value = ''
}
const NAME_RULE = 'a name without spaces that no other section has'
function applySheetDialog(v: BarDialogSubmit): void {
  const d = sheetDialog.value
  const doc = editor.doc.value
  if (!d) return
  const change = ((): { next: ChartDoc; said: string; why: string } | null => {
    switch (v.kind) {
      case 'section':
        return { next: addSection(doc, v.name, v.chords), said: `${v.name} added`, why: `A new section needs ${NAME_RULE}, and a chord or more.` }
      case 'split':
        return { next: splitSection(doc, d.section, d.bar, v.name), said: `${v.name} starts at bar ${d.bar}`, why: `A new section needs ${NAME_RULE}, and starts on a bar with a chord, after the first, not inside an ending, and not in a section that’s repeated.` }
      case 'nav':
        return { next: setNav(doc, d.section, d.bar, v.text), said: `${d.section}, bar ${d.bar}: ${v.text || 'no jump'}`, why: 'The chart can’t take a jump there.' }
      case 'paste': {
        const bar = d.bar + (v.before ? 0 : 1)
        return { next: insertBars(doc, d.section, bar, v.bars), said: `${d.section}: ${v.bars.length === 1 ? '1 bar' : `${v.bars.length} bars`} added at bar ${bar}`, why: v.before ? 'Those bars can’t go there: a section can’t start with a held bar.' : 'Those bars can’t go there.' }
      }
      case 'repeat':
        return { next: repeatSection(doc, v.src, v.name), said: `${v.name} repeats ${v.src}`, why: `A repeat needs ${NAME_RULE}, in the same part as ${v.src}.` }
      case 'rename':
        return { next: renameSection(doc, d.section, v.name), said: `${d.section} is now ${v.name}`, why: `A section needs ${NAME_RULE}, and stays in or out of the form.` }
      default:
        return null
    }
  })()
  if (!change) return
  if (change.next === doc) return void (sheetDialogError.value = change.why)
  editor.setDoc(change.next)
  said.value = change.said
  sheetDialog.value = null
}
/** the ghost bar: a bar after the section's last (before a part's rounding-out bars) */
function sheetAddBar(section: string): void {
  const last = sheetView.value.sections.find((x) => x.name === section)?.bars.at(-1)?.bar
  if (last === undefined) return
  const next = insertHeldBar(editor.doc.value, section, last + 1)
  if (next === editor.doc.value) return void (said.value = 'No bar can go there.')
  editor.setDoc(next)
  said.value = `${section}: bar ${last + 1} added`
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

/** the line under the sheet's heading: where the chart is saved (a shared chart: not yet) */
const statusText = computed((): string => (saved ? saveText.value : props.shared ? 'A shared chart. It isn’t saved in this browser until you save it.' : ''))
const saveFailed = computed(() => saved?.status.value.state === 'failed')

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
  pentPath.carryTo(`mine:${id}`)
  chordPicks.carryTo(`mine:${id}`)
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
    ...(mode.value === 'from' && prefs.spell.value !== 'key' ? { start: start.value } : {}), // none: from the key
    intervals: prefs.intervals.value,
    numerals: prefs.numerals.value,
    scaleNames: prefs.scaleNames.value,
    ...(sheetLine.value !== 'off' ? { line: sheetLine.value } : {}), // absent: off
    sheet: sheet.value,
    ...(sheet.value === 'changes' && approachShown.value !== 'none' ? { approach: approachShown.value } : {}), // the line's Approach (#298, #381)
    ...(sheet.value === 'patterns' ? { pattern: prefs.pattern.value, patternNotes: prefs.patternNotes.value, patternDir: prefs.patternDir.value } : {}),
    ...(sheet.value === 'arpeggios' ? { arpNotes: prefs.arpNotes.value, arpDir: prefs.arpDir.value } : {}),
    ...(sheet.value === 'changes' && prefs.lineMode.value === 'arpeggio' ? { arpDir: prefs.arpDir.value, pentLeave: prefs.pentLeave.value } : {}), // the Pentatonic (#284) and Triad pair (#325) lines', under the receiver's own overlay
    ...(selection.value ? { practice: selection.value } : {}),
    ...(scaleLevel.level.value !== 'standard' ? { level: scaleLevel.level.value, seed: scaleLevel.seed.value } : {}),
    ...(hasPicks(chordPicks.live.value) ? { picks: chordPicks.live.value } : {}), // too big a link leaves them out (encodeShare)
  }
  return `${location.origin}/song#s=${await encodeShare({ chart: editor.text.value, view })}`
}

async function openShare(): Promise<void> {
  shareLink.value = null
  shareOpen.value = true
  shareLink.value = await shareUrl()
  send({ name: 'Share created', data: { song: song() } })
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
  pentPath.carryTo(`mine:${id}`)
  chordPicks.carryTo(`mine:${id}`)
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
  focus.enter(compactRail.value ? document.getElementById('controls-button') : undefined) // from the Controls dialog: back to Controls
  nextTick(() => focusBar.value?.querySelector('button')?.focus())
}

function print(): void {
  editor.flush() // include anything typed in the last moment
  send({ name: 'Printed', data: { sheet: sheet.value, song: song() } })
  nextTick(() => window.print())
}

/** a transposed library chart is no longer the one published: it's named as it was before */
function onTransposed(doc: ChartDoc): void {
  const was = song()
  editor.setDoc(doc)
  send({ name: 'Transposed', data: { song: was, to: chartMeta(doc).key } })
}

/** anonymous Web Analytics events (#149, off until on Pro): changes only, never on load; the chart by library slug or "own" */
const eventsOn = useFeature('analyticsEvents')
const song = (): string => songOf(props.saveTarget, editor.text.value, props.shared !== undefined)
const send = (e: AnalyticsEvent): void => sendEvent(e, eventsOn)
onMounted(() => {
  if (props.shared) send({ name: 'Shared link opened', data: { song: song() } })
})
watch(sheet, (s) => send({ name: 'Sheet chosen', data: { sheet: s } }))
// once per visit: a new chart remounts this view (the song page's editorKey), so flipping through parts counts once
let instrumentSent = false
watch(
  () => prefs.instrument.value,
  (i) => {
    if (instrumentSent) return
    instrumentSent = true
    send({ name: 'Instrument chosen', data: { instrument: i } })
  },
)

/** send the chart and its context to the contact form (via sessionStorage), pre-filled for a bug report */
/** the rail's More menu: what this chart offers now */
const moreItems = computed(() => moreMenuItems({ saved: !!saved, edited: !!saved?.edited.value, fatal: editor.fatal.value, picks: hasPicks(chordPicks.live.value) }))
function onMore(action: MoreAction): void {
  if (action === 'copy') saveCopy()
  else if (action === 'download') download()
  else if (action === 'revert') revertOpen.value = true
  else if (action === 'reset-picks') {
    chordPicks.clearAll()
    said.value = 'Chord picks reset'
  }
  else reportError()
}

function reportError(): void {
  editor.flush()
  const report: ChartReport = {
    chart: editor.text.value,
    slug: props.saveTarget && 'slug' in props.saveTarget ? props.saveTarget.slug : '',
    title: editor.heading.value.title,
    version: String(useRuntimeConfig().public.version ?? ''),
    instrument: instrumentOption(prefs.instrument.value),
    sheet: sheet.value,
    guides: guidesText(changesLine.value),
    level: scaleLevel.level.value,
    url: location.href,
  }
  sessionStorage.setItem(CHART_REPORT_KEY, JSON.stringify(report))
  navigateTo('/contact')
}
</script>
