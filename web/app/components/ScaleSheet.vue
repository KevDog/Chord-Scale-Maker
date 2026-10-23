<template>
  <SheetPages :title="title" :composer="composer" :pages="pages" :heading-level="headingLevel">
    <template v-if="$slots.status" #status><slot name="status" /></template>
    <template #default="{ page }">
      <div class="space-y-1 print:space-y-2">
        <ScaleStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" :intervals="intervals" :part="part" :pickable="pickable" :quartal="isQuartalSelection(practice ?? null)" :rhythm="rhythm" @pick="(...a) => emit('pick', ...a)" />
      </div>
    </template>
  </SheetPages>
</template>

<script setup lang="ts">
import { buildSheet, type ChordAt, isQuartalSelection, type ChordPicks, type Key, type NotesPerBar, type PickKind, type ModeChoice, type Part, pageSubtitle, type PracticeSelection, type Resolved, type RhythmId, type Row, sheetRhythmText } from '@chord-scale-maker/engine'

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
  rhythmPerPage?: number // staves a page where any staff has a rhythm card or a run (default perPage)
  intervals?: boolean // label notes against the chord root, on screen only
  practice?: PracticeSelection | null // highlight these notes, dim the rest
  homeKey?: Key | null // the chart's key, for the key signature (null: no key: line); undefined: none
  resolved?: ReadonlyMap<number, Resolved> // what each row plays (resolveScales); undefined: its own scale or its quality's default
  keys?: ReadonlyMap<number, string> // each row's key area (rowKeys), for the Hexatonic preset ranked against the key (#432)
  picks?: ChordPicks // the chord picks (#303), played where positions are given too
  positions?: ReadonlyMap<number, ChordAt> // each row's drawn position (chordPositions)
  pickable?: boolean // captions open the chord pick popover
  rhythm?: RhythmId // the rhythm in force on this sheet: a card under each staff, named in the subtitle (rhythm-scales-arpeggios spec §1, §6)
  notesPerBar?: NotesPerBar // Notes per bar: the scale run in bars of N (rhythm-scales-arpeggios spec §2, §3), named in the subtitle; default Whole notes
  beatsOf?: (row: number) => number // the bar length in beats of each row (rowBarBeats; default 4)
}>()
const emit = defineEmits<{ pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null] }>()

/** every printed page, in order, with its own heading */
const build = (perPage: number) =>
  buildSheet(props.rows, props.part, props.mode, props.start, perPage, props.practice ?? null, props.homeKey, props.resolved, props.picks && props.positions ? { picks: props.picks, at: props.positions } : undefined, props.keys, { rhythm: props.rhythm, notesPerBar: props.notesPerBar, beatsOf: props.beatsOf })
const timedSheet = (parts: ReturnType<typeof build>): boolean => parts.some((p) => p.pages.some((page) => page.some((s) => s.card || s.run)))
/** the sheet, at rhythmPerPage a page where any staff has a rhythm card or a run (rhythm-scales-arpeggios spec §8) */
const sheet = computed(() => {
  const parts = build(props.perPage)
  const perPage = props.rhythmPerPage ?? props.perPage
  return perPage !== props.perPage && timedSheet(parts) ? build(perPage) : parts
})
/** the subtitle names the rhythm and the notes per bar only where a staff draws them (spec §6) */
const rhythmText = computed(() => (timedSheet(sheet.value) ? sheetRhythmText(props.rhythm ?? 'off', props.notesPerBar) : []))
const pages = computed(() =>
  sheet.value
    .flatMap((sheetPart) =>
      sheetPart.pages.map((staves) => ({
        mode: sheetPart.mode,
        staves,
        subtitle: pageSubtitle(props.subtitle, props.instrumentLabel, sheetPart.heading, rhythmText.value),
      })),
    ),
)
</script>
