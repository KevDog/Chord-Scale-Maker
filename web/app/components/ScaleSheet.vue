<template>
  <SheetPages :title="title" :composer="composer" :pages="pages" :heading-level="headingLevel">
    <template v-if="$slots.status" #status><slot name="status" /></template>
    <template #default="{ page }">
      <div class="space-y-1 print:space-y-2">
        <ScaleStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" :intervals="intervals" :part="part" :pickable="pickable" :quartal="isQuartalSelection(practice ?? null)" @pick="(...a) => emit('pick', ...a)" />
      </div>
    </template>
  </SheetPages>
</template>

<script setup lang="ts">
import { buildSheet, type ChordAt, isQuartalSelection, type ChordPicks, type Key, type PickKind, type ModeChoice, type Part, pageSubtitle, type PracticeSelection, type Resolved, type RhythmId, type Row, sheetRhythmText } from '@chord-scale-maker/engine'

const props = defineProps<{
  rows: readonly Row[]
  title: string
  subtitle: string
  composer?: string
  headingLevel?: 1 | 2 // the title as the page's h1 (SheetPages)
  part: Part
  instrumentLabel: string // e.g. "Tenor Sax (Bb)"; '' while editing in concert pitch
  start: string // written start note for the "from" part
  mode: ModeChoice
  perPage: number
  intervals?: boolean // label notes against the chord root, on screen only
  practice?: PracticeSelection | null // highlight these notes, dim the rest
  homeKey?: Key | null // the chart's key, for the key signature (null: no key: line); undefined: none
  resolved?: ReadonlyMap<number, Resolved> // what each row plays (resolveScales); undefined: its own scale or its quality's default
  keys?: ReadonlyMap<number, string> // each row's key area (rowKeys), for the Hexatonic preset ranked against the key (#432)
  picks?: ChordPicks // the chord picks (#303), played where positions are given too
  positions?: ReadonlyMap<number, ChordAt> // each row's drawn position (chordPositions)
  pickable?: boolean // captions open the chord pick popover
  rhythm?: RhythmId // the rhythm in force on this sheet: a card under each staff, named in the subtitle (rhythm-scales-arpeggios spec §1, §6)
  beatsOf?: (row: number) => number // the bar length in beats of each row (rowBarBeats; default 4)
}>()
const emit = defineEmits<{ pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null] }>()

/** every printed page, in order, with its own heading */
const pages = computed(() =>
  buildSheet(props.rows, props.part, props.mode, props.start, props.perPage, props.practice ?? null, props.homeKey, props.resolved, props.picks && props.positions ? { picks: props.picks, at: props.positions } : undefined, props.keys, { rhythm: props.rhythm, beatsOf: props.beatsOf })
    .flatMap((sheetPart) =>
      sheetPart.pages.map((staves) => ({
        mode: sheetPart.mode,
        staves,
        subtitle: pageSubtitle(props.subtitle, props.instrumentLabel, sheetPart.heading, sheetRhythmText(props.rhythm ?? 'off')),
      })),
    ),
)
</script>
