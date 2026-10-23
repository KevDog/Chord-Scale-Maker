<template>
  <div data-slot="scale-staff" :class="stacked ? 'space-y-2' : 'grid grid-cols-[8rem_1fr] items-center gap-3 break-inside-avoid print:grid-cols-[8.5rem_1fr]'">
    <div :class="['leading-tight', !stacked && 'text-right']">
      <div v-if="staff.scale" class="text-base font-semibold"><NoteName :note="staff.scale.root" /> {{ staff.scale.name }}</div>
      <div class="text-sm text-zinc-500 dark:text-zinc-400 print:text-neutral-600">
        <template v-for="(tokens, i) in staff.chords" :key="i"><template v-if="i"><span class="sr-only">,</span><span aria-hidden="true"> · </span></template><ChordSymbol v-if="tokens" :tokens="tokens" /><span v-else>—</span></template>
      </div>
      <!-- the Pentatonic preset's pentatonic, or the Hexatonic preset's pair or none (staff.second is set only under it); a trigger for every bar it covers (#303) -->
      <div v-if="kind" :data-slot="kind" class="text-sm text-zinc-500 dark:text-zinc-400 print:text-[0.625rem] print:leading-none print:tracking-tight print:whitespace-nowrap print:text-neutral-600">
        <ChordPickPopover
          v-if="canPick"
          :text="caption"
          :trigger-label="triggerLabel"
          :header="header"
          :footer="footer"
          :sheet-choice="sheetChoice"
          :picked="picked"
          :rows="rows"
          trigger-class="text-right"
          @choose="choose"
          @clear="emit('pick', kind, staff.positions, null)"
        />
        <template v-else>{{ caption }}</template>
      </div>
      <!-- the Quartal preset's stack of fourths, or none (#432) -->
      <div v-if="quartal" data-slot="quartal" class="text-sm text-zinc-500 dark:text-zinc-400 print:text-[0.625rem] print:leading-none print:tracking-tight print:whitespace-nowrap print:text-neutral-600">{{ quartalCaption(staff.quartal) }}</div>
    </div>
    <div v-if="staff.error || drawError" class="rounded border border-dashed border-amber-500 px-3 py-6 text-sm text-amber-700 dark:text-amber-400">
      {{ staff.error || drawError }}
    </div>
    <div v-else>
      <div ref="el" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
      <!-- on screen only, so print keeps its 12 staves a page -->
      <p v-if="intervals && labels && xs.length" class="relative h-4 text-xs/4 text-zinc-600 tabular-nums dark:text-zinc-400 print:hidden">
        <span class="sr-only">Intervals from the chord root:</span>
        <span
          v-for="(label, i) in labels"
          :key="i"
          :class="['absolute -translate-x-1/2', staff.selected?.[sources[i] ?? i] && 'font-semibold text-zinc-950 dark:text-zinc-50']"
          :style="{ left: `${(xs[i] ?? 0) * 100}%` }"
        >{{ glyphs(label) }}</span>
      </p>
      <!-- the rhythm card (rhythm-scales-arpeggios spec §1): drawn under the staff and its intervals -->
      <div v-if="staff.card && rhythm && rhythm !== 'off'" ref="card" data-slot="rhythm-card" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ChordAt, glyphs, hexatonicCaption, hexatonicChoices, type Part, PENTATONIC_DEGREE_LABELS, pentatonicCaption, pentatonicChoices, pickBars, pickHeading, type PickKind, quartalCaption, type RhythmId, rhythmLabel, rootName, type StaffModel } from '@chord-scale-maker/engine'
import { choiceId, hexChoiceRows, pickFooter, pickHeader } from '~/utils/chordPicks'
import type { ChoiceRow } from './ChordPickPopover.vue'

/** rhythm: the sheet's, for the card's label; intervals: label each note against the chord root (b9, #11…); part and pickable: the caption picks for every bar it covers (#303); quartal: the Quartal preset is on, so its caption shows (#432) */
/** stacked: its label above it, the staff across the full width and drawn larger (a reference page's one staff, #498) */
const props = defineProps<{ staff: StaffModel; clef: 'treble' | 'bass'; intervals?: boolean; part?: Part; pickable?: boolean; quartal?: boolean; rhythm?: RhythmId; stacked?: boolean }>()
const emit = defineEmits<{ pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null] }>()

const kind = computed((): PickKind | null => (props.staff.pentatonic ? 'pentatonic' : props.staff.second ? 'hexatonic' : null))
const caption = computed(() => (props.staff.pentatonic ? pentatonicCaption(props.staff.pentatonic, props.staff.varies) : hexatonicCaption(props.staff.hexatonic, props.staff.varies)))
const canPick = computed(() => !!props.pickable && !!props.part && !!props.staff.source && props.staff.positions.length > 0 && (kind.value !== 'hexatonic' || !!props.staff.hexatonic))
const bars = computed(() => pickBars(props.staff.positions))
const header = computed(() => (props.staff.source && props.part ? pickHeader(pickHeading(props.part, props.staff.source.chord, props.staff.source.scale), bars.value) : ''))
const footer = computed(() => pickFooter('scales', bars.value, props.staff.varies))
const sheetChoice = computed(() => props.staff.pentatonic?.sheet ?? props.staff.hexatonic?.sheet ?? 'no triad pair')
const picked = computed(() => !!(props.staff.pentatonic?.picked ?? props.staff.hexatonic?.picked))
const pentRows = computed(() => (canPick.value && kind.value === 'pentatonic' ? pentatonicChoices(props.staff.source!.chord, props.staff.source!.scale, props.part!) : []))
const hexRows = computed(() => (canPick.value && kind.value === 'hexatonic' ? hexatonicChoices(props.staff.source!.chord, props.staff.source!.scale, props.part!) : []))
const rows = computed((): readonly ChoiceRow[] =>
  kind.value === 'pentatonic'
    ? pentRows.value.map((c) => ({ id: choiceId.pent(c.pc), label: c.label, current: c.name === props.staff.pentatonic?.name }))
    : hexChoiceRows(hexRows.value, props.staff.hexatonic?.name))
/** the caption in words, as the Changes labels say it (#303); the popover adds ', your pick' */
const triggerLabel = computed((): string => {
  const p = props.staff.pentatonic
  const sc = props.staff.scale ? ` in ${glyphs(`${rootName(props.staff.scale.root)} ${props.staff.scale.name}`)}` : ''
  const varies = props.staff.varies ? ', varies' : ''
  if (p) return `Pentatonic: ${p.name.replace(/m$/, '')} minor, built on ${PENTATONIC_DEGREE_LABELS[p.degree] ?? '1'}, ${p.shared} of 5 notes${sc}${varies}`
  const h = props.staff.hexatonic
  if (!h) return 'Triad pair: none'
  const covers = hexRows.value.find((c) => c.name === h.name)?.coverage
  return `Triad pair: ${glyphs(h.name)}${covers === undefined ? '' : `, covers ${covers} chord tones`}${varies}`
})
function choose(id: string): void {
  const p = pentRows.value.find((c) => choiceId.pent(c.pc) === id)
  const h = hexRows.value.find((c) => choiceId.hex(c.roots) === id)
  if (kind.value === 'pentatonic' && p) emit('pick', 'pentatonic', props.staff.positions, p.pc)
  else if (kind.value === 'hexatonic' && h) emit('pick', 'hexatonic', props.staff.positions, h.roots)
}
/** the staff note each drawn note repeats: a run's (D15), else each its own */
const sources = computed((): readonly number[] => props.staff.run?.source ?? props.staff.notes.map((_, i) => i))
/** the interval labels, one a drawn note: a run's repeat its staff note's */
const labels = computed(() => (props.staff.intervals ? sources.value.map((s) => props.staff.intervals?.[s] ?? '') : null))
const el = useTemplateRef<HTMLDivElement>('el')
const cardEl = useTemplateRef<HTMLDivElement>('card')
const drawError = ref<string | null>(null)
/** a stacked staff's drawing width: about two-thirds of a sheet staff's, so it draws half as large again */
const STACKED_WIDTH = 440
const xs = ref<number[]>([])
const rendering = useRendering()

async function draw(): Promise<void> {
  if (props.staff.error) return
  const done = rendering.begin()
  try {
    const vf = await loadVexFlow()
    if (!el.value) return // still showing a previous draw error; keep it
    // a run poured into the rhythm names it in its label (spec §7); an even run (Rhythm Off) names none
    xs.value = drawStaff(vf, el.value, props.staff, props.clef, props.stacked ? STACKED_WIDTH : undefined, props.rhythm && props.rhythm !== 'off' ? `Rhythm: ${rhythmLabel(props.rhythm)}` : null)
    // a card is drawn for the rhythm in force, which names it: none without one (a stacked reference staff takes no rhythm)
    if (props.staff.card && cardEl.value && props.rhythm && props.rhythm !== 'off') drawRhythmCard(vf, cardEl.value, props.staff.card, staffNotesWidth(vf, props.staff, props.clef), cardAria(rhythmLabel(props.rhythm), props.staff.card))
    drawError.value = null
  } catch (e) {
    drawError.value = `Couldn't draw this staff (${e instanceof Error ? e.message : String(e)})`
  } finally {
    done()
  }
}

onMounted(draw)
// a primitive key: re-parses create new staff objects, but only real changes should redraw
watch(() => `${props.staff.id}|${props.staff.last}|${props.clef}|${props.staff.selected?.join() ?? ''}|${props.staff.second?.join() ?? ''}|${props.staff.outside?.join() ?? ''}`, () => nextTick(draw))
</script>
