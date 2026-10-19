<template>
  <SheetPages :title="title" :composer="composer" :pages="pages" :heading-level="headingLevel">
    <template v-if="$slots.status" #status><slot name="status" /></template>
    <template #default="{ page }">
      <div class="space-y-1 print:space-y-2">
        <ArpeggioStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" :intervals="intervals" :part="part" :pickable="pickable" @pick="(...a) => emit('pick', ...a)" />
      </div>
    </template>
  </SheetPages>
</template>

<script setup lang="ts">
import { type ArpDirection, type ArpNotes, buildArpeggioSheet, buildPatternSheet, type ChordAt, type ChordPicks, type Key, type Moves, type PairShape, type PatternNotes, pageSubtitle, type Part, type PickKind, type Resolved, type Row } from '@chord-scale-maker/engine'

const props = defineProps<{
  rows: readonly Row[]
  title: string
  subtitle: string
  composer?: string
  headingLevel?: 1 | 2 // the title as the page's h1 (SheetPages)
  part: Part
  instrumentLabel: string
  perPage: number
  notes: ArpNotes | PatternNotes
  moves?: Moves // the Patterns sheet: this pattern over each line, in place of the arpeggio
  dir: ArpDirection
  intervals?: boolean
  homeKey?: Key | null
  resolved?: ReadonlyMap<number, Resolved>
  shape?: PairShape // Triad pairs (#436): Arpeggiated or Block
  keys?: ReadonlyMap<number, string> // Triad pairs ranked against the key (#432): each row's key area (rowKeys); undefined: each chord's Auto
  picks?: ChordPicks // Triad pairs: the chord picks (#303), played where positions are given too
  positions?: ReadonlyMap<number, ChordAt> // each row's drawn position (chordPositions)
  pickable?: boolean // Triad pairs' captions open the chord pick popover
}>()
const emit = defineEmits<{ pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null] }>()

/** every printed page, in order, with its heading */
const pages = computed(() => {
  const sheet = props.moves
    ? buildPatternSheet(props.rows, props.part, props.perPage, props.moves, props.notes as PatternNotes, props.dir, props.homeKey, props.resolved)
    : buildArpeggioSheet(props.rows, props.part, props.perPage, props.notes as ArpNotes, props.dir, props.homeKey, props.resolved, {
        shape: props.shape,
        keys: props.keys,
        picks: props.picks && props.positions ? { picks: props.picks, at: props.positions } : undefined,
      })
  return sheet.pages.map((staves) => ({ staves, subtitle: pageSubtitle(props.subtitle, props.instrumentLabel, sheet.heading) }))
})
</script>
