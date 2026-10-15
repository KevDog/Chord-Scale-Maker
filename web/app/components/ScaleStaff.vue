<template>
  <div class="grid grid-cols-[8rem_1fr] items-center gap-3 break-inside-avoid print:grid-cols-[8.5rem_1fr]">
    <div class="text-right leading-tight">
      <div v-if="staff.scale" class="text-base font-semibold"><NoteName :note="staff.scale.root" /> {{ staff.scale.name }}</div>
      <div class="text-sm text-zinc-500 dark:text-zinc-400 print:text-neutral-600">
        <template v-for="(tokens, i) in staff.chords" :key="i"><template v-if="i"><span class="sr-only">,</span><span aria-hidden="true"> · </span></template><ChordSymbol v-if="tokens" :tokens="tokens" /><span v-else>—</span></template>
      </div>
      <!-- the Pentatonic preset's pentatonic, or the Hexatonic preset's pair or none (staff.second is set only under it); a trigger for every bar it covers (#303) -->
      <div v-if="kind" :data-slot="kind" class="text-sm text-zinc-500 dark:text-zinc-400 print:text-[0.625rem] print:leading-none print:whitespace-nowrap print:text-neutral-600">
        <ChordPickPopover
          v-if="canPick"
          :text="caption"
          :trigger-label="`${kind === 'pentatonic' ? 'Pentatonic' : 'Triad pair'}: ${caption}`"
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
    </div>
    <div v-if="staff.error || drawError" class="rounded border border-dashed border-amber-500 px-3 py-6 text-sm text-amber-700 dark:text-amber-400">
      {{ staff.error || drawError }}
    </div>
    <div v-else>
      <div ref="el" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
      <!-- on screen only, so print keeps its 12 staves a page -->
      <p v-if="intervals && staff.intervals && xs.length" class="relative h-4 text-xs/4 text-zinc-600 tabular-nums dark:text-zinc-400 print:hidden">
        <span class="sr-only">Intervals from the chord root:</span>
        <span
          v-for="(label, i) in staff.intervals"
          :key="i"
          :class="['absolute -translate-x-1/2', staff.selected?.[i] === false && 'opacity-25 dark:opacity-35 print:opacity-100 print:text-neutral-400']"
          :style="{ left: `${(xs[i] ?? 0) * 100}%` }"
        >{{ glyphs(label) }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ChordAt, glyphs, hexatonicCaption, hexatonicChoices, type Part, pentatonicCaption, pentatonicChoices, pickBars, pickHeading, type PickKind, type StaffModel } from '@chord-scale-maker/engine'
import { choiceId, pickFooter, pickHeader } from '~/utils/chordPicks'
import type { ChoiceRow } from './ChordPickPopover.vue'

/** intervals: label each note against the chord root (b9, #11…); part and pickable: the caption picks for every bar it covers (#303) */
const props = defineProps<{ staff: StaffModel; clef: 'treble' | 'bass'; intervals?: boolean; part?: Part; pickable?: boolean }>()
const emit = defineEmits<{ pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null] }>()

const kind = computed((): PickKind | null => (props.staff.pentatonic ? 'pentatonic' : props.staff.second ? 'hexatonic' : null))
const caption = computed(() => (props.staff.pentatonic ? pentatonicCaption(props.staff.pentatonic, props.staff.varies) : hexatonicCaption(props.staff.hexatonic, props.staff.varies)))
const canPick = computed(() => !!props.pickable && !!props.part && !!props.staff.source && props.staff.positions.length > 0)
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
    : hexRows.value.map((c) => ({ id: choiceId.hex(c.roots), label: c.label, current: c.name === props.staff.hexatonic?.name })))
function choose(id: string): void {
  const p = pentRows.value.find((c) => choiceId.pent(c.pc) === id)
  const h = hexRows.value.find((c) => choiceId.hex(c.roots) === id)
  if (kind.value === 'pentatonic' && p) emit('pick', 'pentatonic', props.staff.positions, p.pc)
  else if (kind.value === 'hexatonic' && h) emit('pick', 'hexatonic', props.staff.positions, h.roots)
}
const el = useTemplateRef<HTMLDivElement>('el')
const drawError = ref<string | null>(null)
const xs = ref<number[]>([])
const rendering = useRendering()

async function draw(): Promise<void> {
  if (props.staff.error) return
  const done = rendering.begin()
  try {
    const vf = await loadVexFlow()
    if (!el.value) return // still showing a previous draw error; keep it
    xs.value = drawStaff(vf, el.value, props.staff, props.clef)
    drawError.value = null
  } catch (e) {
    drawError.value = `Couldn't draw this staff (${e instanceof Error ? e.message : String(e)})`
  } finally {
    done()
  }
}

onMounted(draw)
// a primitive key: re-parses create new staff objects, but only real changes should redraw
watch(() => `${props.staff.id}|${props.staff.last}|${props.clef}|${props.staff.selected?.join() ?? ''}|${props.staff.second?.join() ?? ''}`, () => nextTick(draw))
</script>
