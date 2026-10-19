<template>
  <!-- display: contents, so the rail's sticky box is the whole Preview section -->
  <div id="preview-toolbar" class="contents space-y-4">
    <!-- the rail: labelled groups wrap on the left (Work on · Instrument · Level · Show (on the Changes: Analysis · Line) · Spell Scale), the actions pinned right (on their own line, still right, once the row is too narrow); top-aligned so every label sits on one line -->
    <SheetRail :sticky="stickyRail">
      <template #left>
        <UiField class="w-36">
          <UiLabel class="pl-3">Work on</UiLabel>
          <!-- a plain wrapper (not data-slot=control) so the label gap matches the other groups -->
          <div class="flex items-center gap-2">
            <UiListbox v-model="sheet" class="w-full">
              <template #selected="{ value }"><UiListboxLabel>{{ sheetLabel(value) }}</UiListboxLabel></template>
              <UiListboxOption v-for="s in sheetsFor(patternsOn && shows('patterns'))" :key="s.value" :value="s.value"><UiListboxLabel>{{ s.label }}</UiListboxLabel></UiListboxOption>
            </UiListbox>
          </div>
        </UiField>
        <!-- one control: what's set ("Piano · F3–E6"), its pitch, instrument and range in a panel below (set once, so a click away) -->
        <UiField class="w-44">
          <UiLabel class="pl-3">Instrument</UiLabel>
          <RailPopover v-model:open="instrumentOpen" label="Instrument" :summary="instrumentSummary">
            <span class="text-xs/5 font-medium text-zinc-500 dark:text-zinc-400">Pitch and instrument</span>
            <InstrumentPicker v-model="instrument" class="w-72" @chosen="emit('instrumentChosen', $event)" />
            <!-- #359: the player's range, the written notes the lines keep to (moving one end pushes the other to keep two octaves) -->
            <template v-if="playerRange && range">
              <span class="mt-1 text-xs/5 font-medium text-zinc-500 dark:text-zinc-400">Range</span>
              <div class="flex w-72 items-center gap-2">
                <UiListbox :model-value="range.lo" class="min-w-0 flex-1" aria-label="Lowest note" title="The lowest written note the lines use" @update:model-value="(lo) => lo !== undefined && setRange({ lo, hi: range!.hi }, 'lo')">
                  <template #selected="{ value }"><UiListboxLabel>{{ noteName(value) }}</UiListboxLabel></template>
                  <UiListboxOption v-for="n in rangeNotes.lows" :key="n" :value="n"><UiListboxLabel>{{ noteName(n) }}</UiListboxLabel></UiListboxOption>
                </UiListbox>
                <span class="text-zinc-500" aria-hidden="true">–</span>
                <UiListbox :model-value="range.hi" class="min-w-0 flex-1" aria-label="Highest note" title="The highest written note the lines use" @update:model-value="(hi) => hi !== undefined && setRange({ lo: range!.lo, hi }, 'hi')">
                  <template #selected="{ value }"><UiListboxLabel>{{ noteName(value) }}</UiListboxLabel></template>
                  <UiListboxOption v-for="n in rangeNotes.highs" :key="n" :value="n"><UiListboxLabel>{{ noteName(n) }}</UiListboxLabel></UiListboxOption>
                </UiListbox>
              </div>
            </template>
          </RailPopover>
        </UiField>
        <!-- the other groups: in the rail, or on a phone (compact) in the Controls dialog -->
        <component :is="compact ? ControlsDialog : Passthrough" v-bind="compact ? { open: controlsOpen, onClose: () => (controlsOpen = false), onClosed: runAfterClose } : {}">
          <!-- groups the Interface level shows or hides fade in and out (#297) -->
          <Transition name="ease-fade">
            <UiField v-if="$slots.level && shows('scale-level')">
              <UiLabel class="pl-3">Level</UiLabel>
              <div class="flex items-center gap-2"><slot name="level" /></div>
            </UiField>
          </Transition>
          <UiField v-if="sheet !== 'changes'">
            <UiLabel class="pl-3">Show</UiLabel>
            <div class="flex flex-wrap gap-2 *:whitespace-nowrap">
              <ToggleButton v-model="intervals" title="Label each note against the chord root (on screen only)">Intervals</ToggleButton>
            </div>
          </UiField>
          <template v-else>
            <Transition name="ease-fade">
              <UiField v-if="analysisShown || overlayShown">
                <UiLabel class="pl-3">Analysis</UiLabel>
                <!-- one row, so the group is one control tall; stacked in the Controls dialog -->
                <div :class="compact ? 'flex flex-col items-start gap-2' : 'flex items-start gap-2'">
                  <EaseReveal :show="analysisShown" inner-class="flex flex-wrap gap-2 *:whitespace-nowrap">
                    <ToggleButton v-model="numerals" title="Each chord's Roman numeral in its key">Numerals</ToggleButton>
                    <ToggleButton v-model="scaleNames" title="Each chord's scale, under its numeral">Scales</ToggleButton>
                  </EaseReveal>
                  <!-- the row under the chords: Off, each key area's or chord's minor pentatonic, or each chord's hexatonic pair; the Pentatonic options open to its right, over the sheet, so the rail keeps its two rows (#293), stacked under it in the Controls dialog -->
                  <!-- in the rail, a fixed width that holds the options' chevron whether or not it shows, so choosing an option never rewraps the rail (#387) -->
                  <EaseReveal :show="overlayShown" :inner-class="compact ? 'flex flex-col items-start gap-2' : 'flex w-66 items-start gap-1'">
                    <UiListbox v-model="overlay" :class="compact ? 'w-60' : 'w-56'" aria-label="Superimpose" :title="OVERLAY_TITLE">
                      <template #selected="{ value }"><UiListboxLabel>Superimpose: {{ overlayLabel(value) }}</UiListboxLabel></template>
                      <UiListboxOption v-for="o in OVERLAY_CHOICES" :key="o.value" :value="o.value"><UiListboxLabel>{{ o.label }}</UiListboxLabel></UiListboxOption>
                    </UiListbox>
                    <Transition name="ease-fade">
                      <RailPopover v-if="overlay === 'pentatonic'" v-model:open="pentOptionsOpen" :inline="compact" label="Pentatonic options">
                        <SegmentedControl v-model="pentBasis" legend="Ranked against" name="pent-basis" aria-label="Pentatonics ranked against" :options="PENT_BASES" />
                        <EaseReveal :show="pentBasis === 'chord'">
                          <UiListbox v-model="pentDegree" class="w-48" aria-label="Pentatonic built on" title="The degree of each chord its minor pentatonic is built on; Auto: the most inside">
                            <template #selected="{ value }"><UiListboxLabel>Built on: {{ degreeLabel(value) }}</UiListboxLabel></template>
                            <UiListboxOption v-for="d in PENT_DEGREE_CHOICES" :key="d" :value="d"><UiListboxLabel>{{ degreeLabel(d) }}</UiListboxLabel></UiListboxOption>
                          </UiListbox>
                        </EaseReveal>
                        <EaseReveal :show="pentBasis !== 'chord'" inner-class="flex flex-col items-start gap-2">
                          <UiListbox v-model="pentPath" class="w-48" aria-label="Pentatonic path">
                            <template #selected="{ value }"><UiListboxLabel>{{ pathLabel(value) }}</UiListboxLabel></template>
                            <UiListboxOption v-for="p in pathChoices" :key="p.value" :value="p.value"><UiListboxLabel>{{ p.label }}</UiListboxLabel></UiListboxOption>
                          </UiListbox>
                          <EaseReveal :show="pentPath === 'one'" inner-class="flex flex-col items-start gap-2">
                            <UiListbox v-model="pentRung" class="w-48" aria-label="Pentatonic rung">
                              <template #selected="{ value }"><UiListboxLabel>{{ rungLabel(value) }}</UiListboxLabel></template>
                              <UiListboxOption v-for="r in PENT_RUNGS" :key="r.value" :value="r.value"><UiListboxLabel>{{ r.label }}</UiListboxLabel></UiListboxOption>
                            </UiListbox>
                            <EaseReveal :show="sideShown(pentRung)"><SegmentedControl v-model="pentSide" legend="Side" name="pent-side" aria-label="Pentatonic side" :options="PENT_SIDES" /></EaseReveal>
                          </EaseReveal>
                          <EaseReveal :show="pentPath !== 'one' && pentPath !== 'custom'" inner-class="flex flex-col items-start gap-2">
                            <SegmentedControl v-model="pentStepUnit" legend="Step by" name="pent-step" aria-label="Pentatonic step" :options="PENT_STEP_UNITS" />
                            <EaseReveal :show="pentStepUnit === 'bars'"><SegmentedControl v-model="pentStepBarsText" legend="Bars" name="pent-step-bars" aria-label="Bars a step" :options="PENT_STEP_BARS" /></EaseReveal>
                          </EaseReveal>
                        </EaseReveal>
                      </RailPopover>
                    </Transition>
                    </EaseReveal>
                  </div>
                </UiField>
                </Transition>
                <Transition name="ease-fade">
                  <UiField v-if="shows('line')">
                    <UiLabel class="pl-3">Line</UiLabel>
                    <!-- the modes on the rail; their detail (From 3rd, the pattern, the direction, the Approach) behind Line options, so the group is one control tall and never moves (#187); stacked under the modes in the Controls dialog -->
                    <div :class="compact ? 'flex flex-col gap-2' : 'flex items-center gap-1'">
                      <SegmentedControl v-model="lineRadio" legend="Line" name="line-mode" :options="lineModes(overlay)" />
                      <!-- a fixed slot for its button, there or not, so choosing a mode never rewraps the rail -->
                      <div :class="compact ? 'contents' : 'flex size-9 items-center justify-center'">
                        <RailPopover v-if="lineHasOptions" v-model:open="lineOptionsOpen" :inline="compact" label="Line options">
                          <div :class="compact ? 'flex w-full flex-col gap-2' : 'flex w-64 flex-col gap-2'">
                          <EaseReveal :show="lineMode === 'guide'" inner-class="flex flex-col gap-2">
                            <UiListbox v-model="guideLine" class="w-full" aria-label="Guide tone line">
                              <template #selected="{ value }"><UiListboxLabel>{{ guideLabel(value) }}</UiListboxLabel></template>
                              <UiListboxOption v-for="g in GUIDE_LINES" :key="g.value" :value="g.value" :title="g.title"><UiListboxLabel>{{ g.label }}</UiListboxLabel></UiListboxOption>
                            </UiListbox>
                          </EaseReveal>
                          <!-- the Pentatonic line (#284) and the Triad pair line (#325): the direction (the Arpeggios sheet's), and the Pentatonic's Leave out where the Superimpose shows -->
                          <EaseReveal :show="inSlot && overlay !== 'off'" inner-class="flex flex-col gap-2">
                            <UiListbox v-model="arpDir" class="w-full" :aria-label="overlay === 'pentatonic' ? 'Pentatonic direction' : 'Triad pair direction'" title="Each cell up, down, or up and down by turns">
                              <template #selected="{ value }"><UiListboxLabel>{{ ARP_DIRECTION_LABELS[value] }}</UiListboxLabel></template>
                              <UiListboxOption v-for="d in ARP_DIRECTIONS" :key="d" :value="d"><UiListboxLabel>{{ ARP_DIRECTION_LABELS[d] }}</UiListboxLabel></UiListboxOption>
                            </UiListbox>
                            <EaseReveal :show="overlayShown && overlay === 'pentatonic'">
                              <UiListbox v-model="pentLeave" class="w-full" aria-label="Leave out" title="The minor pentatonic's degree each four-note cell leaves out; 1: ♭3 4 5 ♭7, the relative major's 1 2 3 5">
                                <template #selected="{ value }"><UiListboxLabel>Leave out: {{ PENTATONIC_LEAVE_LABELS[value] }}</UiListboxLabel></template>
                                <UiListboxOption v-for="d in PENTATONIC_LEAVES" :key="d" :value="d"><UiListboxLabel>{{ PENTATONIC_LEAVE_LABELS[d] }}</UiListboxLabel></UiListboxOption>
                              </UiListbox>
                            </EaseReveal>
                          </EaseReveal>
                          <!-- the 7th Chords slot's pattern; with the Cells flag, also the melodic cells (#298): a system (A and B in turn) or one cell in every slot -->
                          <EaseReveal :show="inSlot && overlay === 'off'">
                            <UiListbox v-model="slotChoice" class="w-full" aria-label="Arpeggio pattern">
                              <template #selected="{ value }"><UiListboxLabel>{{ slotLabel(value) }}</UiListboxLabel></template>
                              <UiListboxOption v-for="p in ARPEGGIO_PATTERNS" :key="p" :value="p"><UiListboxLabel>{{ ARPEGGIO_LABELS[p] }}</UiListboxLabel></UiListboxOption>
                              <template v-if="cellsOn && shows('cells')">
                                <UiListboxGroup label="Cell systems">
                                  <UiListboxOption v-for="id in SYSTEM_IDS" :key="id" :value="id"><UiListboxLabel>{{ cellLabel(id) }}</UiListboxLabel></UiListboxOption>
                                </UiListboxGroup>
                                <UiListboxGroup label="Cells">
                                  <UiListboxOption v-for="c in SINGLE_CELLS" :key="c.id" :value="c.id"><UiListboxLabel>{{ cellLabel(c.id) }}</UiListboxLabel></UiListboxOption>
                                </UiListboxGroup>
                              </template>
                            </UiListbox>
                          </EaseReveal>
                          <!-- the figure into each chord's first note (#298, #381): under the line's own listbox, so the Line group keeps its width (w-0 min-w-full: the long figure names truncate rather than widen it, the tooltip the whole name) -->
                          <EaseReveal :show="approachesOn && shows('approaches') && approachApplies(lineMode, overlay)">
                            <UiListbox v-model="approach" class="w-0 min-w-full" aria-label="Approach" :title="approachLabel(approach)">
                              <template #selected="{ value }"><UiListboxLabel>{{ approachLabel(value) }}</UiListboxLabel></template>
                              <UiListboxOption v-for="a in APPROACHES" :key="a" :value="a"><UiListboxLabel>{{ APPROACH_LABELS[a] }}</UiListboxLabel></UiListboxOption>
                            </UiListbox>
                          </EaseReveal>
                          </div>
                        </RailPopover>
                      </div>
                    </div>
                  </UiField>
                </Transition>
              </template>
              <UiField v-if="sheet === 'arpeggios'">
                <UiLabel class="pl-3">Arpeggio</UiLabel>
                <div class="flex flex-wrap items-center gap-2">
                  <SegmentedControl v-model="arpNotes" legend="Arpeggio" name="arp-notes" :options="arpNoteOptions" />
                  <!-- Triad pairs (#436): Block joins the directions, as it takes none -->
                  <UiListbox v-model="arpMotion" class="w-32" aria-label="Arpeggio direction">
                    <template #selected="{ value }"><UiListboxLabel>{{ motionLabel(value) }}</UiListboxLabel></template>
                    <UiListboxOption v-for="d in arpMotions" :key="d" :value="d"><UiListboxLabel>{{ motionLabel(d) }}</UiListboxLabel></UiListboxOption>
                  </UiListbox>
                </div>
              </UiField>
              <UiField v-if="sheet === 'patterns' && shows('patterns')">
                <UiLabel class="pl-3">Pattern</UiLabel>
                <div class="flex flex-wrap items-start gap-2">
                  <div class="flex w-44 flex-col gap-2">
                    <UiListbox v-model="patternChoice" class="w-full" aria-label="Pattern">
                      <template #selected="{ value }"><UiListboxLabel>{{ patternChoiceLabel(value) }}</UiListboxLabel></template>
                      <UiListboxOption v-for="p in PATTERN_LIBRARY" :key="p.id" :value="p.id"><UiListboxLabel>{{ p.label }}</UiListboxLabel></UiListboxOption>
                      <UiListboxOption value="custom"><UiListboxLabel>{{ patternChoiceLabel('custom') }}</UiListboxLabel></UiListboxOption>
                    </UiListbox>
                    <template v-if="patternChoice === 'custom'">
                      <UiInput v-model="patternText" aria-label="Custom pattern" placeholder="+1 +1 −1" :invalid="!!patternError" :aria-describedby="patternError ? 'pattern-error' : undefined" />
                      <p v-if="patternError" id="pattern-error" class="text-sm/5 text-red-700 dark:text-red-400">{{ patternError }}</p>
                    </template>
                  </div>
                  <SegmentedControl v-model="patternNotes" legend="Notes" name="pattern-notes" :options="patternNoteOptions" />
                  <UiListbox v-model="patternDir" class="w-28" aria-label="Pattern direction">
                    <template #selected="{ value }"><UiListboxLabel>{{ ARP_DIRECTION_LABELS[value] }}</UiListboxLabel></template>
                    <UiListboxOption v-for="d in ARP_DIRECTIONS" :key="d" :value="d"><UiListboxLabel>{{ ARP_DIRECTION_LABELS[d] }}</UiListboxLabel></UiListboxOption>
                  </UiListbox>
                </div>
              </UiField>
              <Transition name="ease-fade">
                <UiField v-if="sheet === 'scales' && shows('spell')">
                  <UiLabel class="pl-3">Spell Scale</UiLabel>
                  <div class="flex flex-wrap items-center gap-2">
                    <UiListbox v-model="spell" class="w-40" aria-label="Where each scale starts" aria-describedby="start-help">
                      <template #selected="{ value }"><UiListboxLabel>{{ spellLabel(value, keyStart) }}</UiListboxLabel></template>
                      <UiListboxOption v-for="s in SPELLS" :key="s" :value="s"><UiListboxLabel>{{ spellLabel(s, keyStart) }}</UiListboxLabel></UiListboxOption>
                    </UiListbox>
                  </div>
                </UiField>
              </Transition>
              <template v-if="compact" #actions><slot name="actions" place="dialog" :after="afterClose" /></template>
            </component>
          </template>
          <template #right>
            <UiButton v-if="compact" id="controls-button" outline aria-haspopup="dialog" @click="controlsOpen = true"><AdjustmentsHorizontalIcon data-slot="icon" />Controls</UiButton>
            <slot name="actions" place="rail" :after="now" />
          </template>
        </SheetRail>
        <UiText id="start-help" class="sr-only">Each scale from its root, or from a written pitch: the chart's key or any note</UiText>
        <UiText aria-live="polite">
          <template v-if="part.trans !== 'C'">The chart is in concert pitch; the preview is transposed for {{ instrumentOption(instrument).toLowerCase() }}.</template>
          <template v-else-if="part.clef === 'bass'">The preview is in bass clef, concert pitch, for {{ instrumentOption(instrument).toLowerCase() }}.</template>
        </UiText>
      </div>
    </template>

    <script setup lang="ts">
    import { type Approach, APPROACH_LABELS, APPROACHES, ARP_DIRECTION_LABELS, ARP_DIRECTIONS, ARP_NOTES, ARP_NOTES_LABELS, ARPEGGIO_LABELS, ARPEGGIO_PATTERNS, type ArpDirection, CELL_SYSTEMS, type CellId, cellLabel, isCellId, SINGLE_CELLS, type ArpeggioPattern, type ArpNotes, fitRange, type InstrumentName, formatPattern, noteName, parsePattern, partFor, PATTERN_LIBRARY, type PatternNotes, type PentatonicBasis, type PentatonicDegree, PENTATONIC_LEAVE_LABELS, PENTATONIC_LEAVES, type PairShape, PAIR_SHAPE_LABELS, type PentatonicLeave, type PentatonicPathName, type PentatonicSide, type PentatonicStepUnit, type Range, rangeChoices } from '@chord-scale-maker/engine'
    import { degreeLabel, PENT_BASES, PENT_DEGREE_CHOICES, PENT_PATHS, PENT_RUNGS, PENT_SIDES, PENT_STEP_BARS, PENT_STEP_UNITS, pathLabel, rungLabel, sideShown } from '~/utils/pentatonics'
    import { approachApplies, type GuideFrom, type LineMode, lineModes } from '~/utils/sheetLine'
    import { type Overlay, OVERLAY_CHOICES, OVERLAY_TITLE, overlayLabel } from '~/utils/overlay'
    import { type Spell, spellLabel, SPELLS } from '~/utils/scaleChoices'
    import type { SheetKind } from '~/utils/sheets'
    import type { FunctionalComponent } from 'vue'
    import { AdjustmentsHorizontalIcon } from '@heroicons/vue/16/solid'
    import ControlsDialog from './ControlsDialog.vue'
    import RailPopover from './RailPopover.vue'

    /** the preview toolbar, in labelled groups: Work on (sheet), Instrument, #level, Show (on the Changes: Analysis, Guide Tones), in the rail, with #actions at its right */
    const sheet = defineModel<SheetKind>('sheet', { required: true })
    const instrument = defineModel<InstrumentName>('instrument', { required: true })
    /** instrumentChosen: picked from the instrument listbox, not as a pitch's first (InstrumentPicker) */
    const emit = defineEmits<{ instrumentChosen: [InstrumentName] }>()
    const spell = defineModel<Spell>('spell', { required: true })
    const intervals = defineModel<boolean>('intervals', { required: true })
    const numerals = defineModel<boolean>('numerals', { default: true })
    const scaleNames = defineModel<boolean>('scaleNames', { default: true })
    const overlay = defineModel<Overlay>('overlay', { default: 'off' })
    const pentRung = defineModel<number>('pentRung', { default: 0 })
    const pentSide = defineModel<PentatonicSide>('pentSide', { default: 'flat' })
    const pentBasis = defineModel<PentatonicBasis>('pentBasis', { default: 'key' })
    const pentDegree = defineModel<PentatonicDegree>('pentDegree', { default: 'auto' })
    const pentPath = defineModel<PentatonicPathName>('pentPath', { default: 'one' })
    const pathChoices = computed(() => PENT_PATHS.filter((p) => p.value !== 'custom' || pentPath.value === 'custom'))
    const pentStepUnit = defineModel<PentatonicStepUnit>('pentStepUnit', { default: 'section' })
    const pentStepBars = defineModel<2 | 4 | 8>('pentStepBars', { default: 4 })
    /** SegmentedControl's values are strings */
    const pentStepBarsText = computed({ get: () => String(pentStepBars.value) as '2' | '4' | '8', set: (v) => (pentStepBars.value = Number(v) as 2 | 4 | 8) })
    /** the Pentatonic options' popover: it opens as Superimpose turns to Pentatonic, and closes as it leaves (#293) */
    const instrumentOpen = ref(false)
    const lineOptionsOpen = ref(false)
    const instrumentSummary = computed(() => [instrumentOption(instrument.value), playerRange && range.value ? `${noteName(range.value.lo)}–${noteName(range.value.hi)}` : ''].filter(Boolean).join(' · '))
    const pentOptionsOpen = ref(false)
    watch(overlay, (o) => (pentOptionsOpen.value = o === 'pentatonic'))
    const { shows } = useInterface()
    /** what this Interface level shows (#273): Numerals and Scales (hidden while editing too), Superimpose */
    const analysisShown = computed(() => !props.lockLabels && shows('analysis'))
    const overlayShown = computed(() => shows('pentatonics'))
    const lineMode = defineModel<LineMode>('lineMode', { default: 'off' })
    const guideLine = defineModel<GuideFrom>('guideLine', { default: 'third' })
    const approach = defineModel<Approach>('approach', { default: 'none' })
    const arpeggio = defineModel<ArpeggioPattern>('arpeggio', { default: 'up-root' })
    const cells = defineModel<CellId>('cells', { default: '3rd-3rd' })
    const arpNotes = defineModel<ArpNotes>('arpNotes', { default: 'seventh' })
    const arpDir = defineModel<ArpDirection>('arpDir', { default: 'up' })
    const arpShape = defineModel<PairShape>('arpShape', { default: 'arpeggiated' })
    const pattern = defineModel<string>('pattern', { default: '+1 +1 +1 −2' })
    const patternNotes = defineModel<PatternNotes>('patternNotes', { default: 'scale' })
    const patternDir = defineModel<ArpDirection>('patternDir', { default: 'up' })
    const pentLeave = defineModel<PentatonicLeave>('pentLeave', { default: '1' })
    /** the sheet editor is open: numerals and scales are shown (they are the pickers), their toggles hide */
    /** keyStart: the chart's key, written for the instrument (what "From key" starts on) */
    /** compact: a phone with compactRail on: the rail keeps Work on, Instrument and the slot's rail actions; Controls opens the rest */
    /** stickyRail: the rail sticks over the sheet (lg up): while editing */
    const props = defineProps<{ lockLabels?: boolean; keyStart: string; compact?: boolean; stickyRail?: boolean }>()
    defineSlots<{ level?: () => unknown; actions?: (p: { place: 'rail' | 'dialog'; after: (run: () => void) => void }) => unknown }>()
    const controlsOpen = ref(false)
    watch(() => props.compact, () => (controlsOpen.value = false))
    /** an action chosen in the dialog runs once it has closed (Headless UI then returns focus to Controls first); in the rail, now */
    let pending: (() => void) | null = null
    const afterClose = (run: () => void): void => void (pending = run)
    const now = (run: () => void): void => run()
    function runAfterClose(): void {
      const run = pending
      pending = null
      run?.()
    } // across md the groups move: don't reopen it later by itself
    /** the groups' wrapper in the rail: none */
    const Passthrough: FunctionalComponent = (_, { slots }) => slots.default?.()

    const arpNoteOptions = ARP_NOTES.map((value) => ({ value, label: ARP_NOTES_LABELS[value] }))
    /** the Arpeggios sheet's direction listbox: a direction, or under Triad pairs Block (#436) */
    type ArpMotion = ArpDirection | 'block'
    const arpMotions = computed((): readonly ArpMotion[] => (arpNotes.value === 'pairs' ? [...ARP_DIRECTIONS, 'block'] : ARP_DIRECTIONS))
    const motionLabel = (m: ArpMotion): string => (m === 'block' ? PAIR_SHAPE_LABELS.block : ARP_DIRECTION_LABELS[m])
    const arpMotion = computed<ArpMotion>({
      get: () => (arpNotes.value === 'pairs' && arpShape.value === 'block' ? 'block' : arpDir.value),
      set: (m) => {
        if (m === 'block') {
          arpShape.value = 'block'
          return
        }
        if (arpShape.value === 'block') arpShape.value = 'arpeggiated'
        arpDir.value = m
      },
    })
    const patternNoteOptions = [
      { value: 'scale', label: 'Scale' },
      { value: 'chord', label: 'Chord tones' },
    ] as const
    /** the library entry whose canonical text is the stored pattern, else Custom (the box shows the stored text) */
    const libraryId = computed(() => PATTERN_LIBRARY.find((p) => formatPattern(p.moves) === pattern.value)?.id ?? 'custom')
    const customChosen = ref(false)
    const patternChoice = computed({
      get: () => (customChosen.value ? 'custom' : libraryId.value),
      set: (id: string) => {
        customChosen.value = id === 'custom'
        const entry = PATTERN_LIBRARY.find((p) => p.id === id)
        if (!entry) return
        // also the box: re-picking the stored entry changes no `pattern`, so the watch below would not clear bad text
        patternText.value = formatPattern(entry.moves)
        pattern.value = patternText.value
      },
    })
    const patternChoiceLabel = (id: string): string => (id === 'custom' ? 'Custom…' : (PATTERN_LIBRARY.find((p) => p.id === id)?.label ?? ''))
    const patternText = ref(pattern.value)
    const parsed = computed(() => parsePattern(patternText.value))
    const patternError = computed(() => ('error' in parsed.value ? parsed.value.error : ''))
    // a typed pattern that parses is stored (canonical); one that doesn't leaves the stored one as it was
    watch(patternText, () => {
      if ('moves' in parsed.value) pattern.value = formatPattern(parsed.value.moves)
    })
    // the stored pattern changed from outside (a library choice, a reset): the box follows, unless it already says the same
    watch(pattern, (v) => {
      if ('moves' in parsed.value && formatPattern(parsed.value.moves) === v) return // typed here
      patternText.value = v
      if (PATTERN_LIBRARY.some((p) => formatPattern(p.moves) === v)) customChosen.value = false
    })
    const GUIDE_LINES = [
      { value: 'third', label: 'From 3rd', title: "A line that starts on the first chord's 3rd and moves to the nearest guide tone of each chord" },
      { value: 'seventh', label: 'From 7th', title: "A line that starts on the first chord's 7th and moves to the nearest guide tone of each chord" },
    ] as const
    const guideLabel = (v: GuideFrom): string => GUIDE_LINES.find((g) => g.value === v)?.label ?? ''
    const patternsOn = useFeature('patterns')
    const cellsOn = useFeature('cells')
    const approachesOn = useFeature('approaches')
    /** the closed listbox reads Approach: None, not a bare None */
    const approachLabel = (a: Approach): string => (a === 'none' ? 'Approach: None' : APPROACH_LABELS[a])
    const SYSTEM_IDS = Object.keys(CELL_SYSTEMS) as (keyof typeof CELL_SYSTEMS)[]
    // the Cells line shares the 7th Chords slot (#298): the radio reads 7th Chords while a cell is chosen, and picking
    // a cell sets the mode and the cell, a pattern the mode and the pattern; leaving the slot for another mode and coming back restores 7th Chords
    const inSlot = computed(() => lineMode.value === 'arpeggio' || lineMode.value === 'cells')
    /** the line has detail to set (Line options): the guide tone line, a slot's pattern or direction, an Approach */
    const lineHasOptions = computed(() => lineMode.value === 'guide' || inSlot.value || (approachesOn && shows('approaches') && approachApplies(lineMode.value, overlay.value)))
    const lineRadio = computed<LineMode>({
      get: () => (lineMode.value === 'cells' ? 'arpeggio' : lineMode.value),
      set: (v) => { if (!(v === 'arpeggio' && inSlot.value)) lineMode.value = v },
    })
    const slotChoice = computed<ArpeggioPattern | CellId>({
      get: () => (lineMode.value === 'cells' ? cells.value : arpeggio.value),
      set: (v) => {
        if (isCellId(v)) { cells.value = v; lineMode.value = 'cells' } else { arpeggio.value = v; lineMode.value = 'arpeggio' }
      },
    })
    const slotLabel = (v: ArpeggioPattern | CellId): string => (isCellId(v) ? cellLabel(v) : ARPEGGIO_LABELS[v])
    const sheetLabel = (v: SheetKind): string => SHEETS.find((s) => s.value === v)?.label ?? ''
    const part = computed(() => partFor(instrument.value))

    /** #359: the player's range for the instrument (none: no pickers) */
    const range = defineModel<Range>('range')
    const playerRange = useFeature('playerRange')
    const rangeNotes = computed(() => rangeChoices(instrument.value))
    const setRange = (want: { lo: number; hi: number }, moved: 'lo' | 'hi'): void => void (range.value = fitRange(instrument.value, want, moved))
    </script>
