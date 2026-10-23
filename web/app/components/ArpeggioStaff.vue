<template>
  <div class="grid grid-cols-[8rem_1fr] items-center gap-3 break-inside-avoid print:grid-cols-[8.5rem_1fr]">
    <div class="text-right leading-tight">
      <div v-if="staff.scale" class="text-base font-semibold"><NoteName :note="staff.scale.root" /> {{ staff.scale.name }}</div>
      <div class="text-sm text-zinc-500 dark:text-zinc-400 print:text-neutral-600">
        <template v-for="(tokens, i) in staff.chords" :key="i"><template v-if="i"><span class="sr-only">,</span><span aria-hidden="true"> · </span></template><ChordSymbol v-if="tokens" :tokens="tokens" /><span v-else>—</span></template>
      </div>
      <!-- Triad pairs (#436): the pair and what it covers, or none; a trigger for every bar it covers, as on the Scales sheet -->
      <div v-if="pair" data-slot="hexatonic" class="text-sm text-zinc-500 dark:text-zinc-400 print:text-[0.625rem] print:leading-none print:tracking-tight print:whitespace-nowrap print:text-neutral-600">
        <ChordPickPopover
          v-if="canPick"
          :text="caption"
          :trigger-label="triggerLabel"
          :header="header"
          :footer="footer"
          :sheet-choice="pair.hexatonic?.sheet ?? 'no triad pair'"
          :picked="!!pair.hexatonic?.picked"
          :rows="rows"
          trigger-class="text-right"
          @choose="choose"
          @clear="emit('pick', 'hexatonic', pair.positions, null)"
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
          class="absolute -translate-x-1/2"
          :style="{ left: `${(xs[i] ?? 0) * 100}%` }"
        >{{ glyphs(label) }}</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ArpeggioStaffModel, type ChordAt, glyphs, hexatonicChoices, pairCaption, pickBars, pickHeading, type Part, type PickKind, type RhythmId, rhythmLabel } from '@chord-scale-maker/engine'
import { choiceId, hexChoiceRows, pickFooter, pickHeader } from '~/utils/chordPicks'
import type { ChoiceRow } from './ChordPickPopover.vue'

/** intervals: label each note against the chord root (b9, #11…); part and pickable: Triad pairs' caption picks for every bar it covers (#436); rhythm: the sheet's, which a run is poured into, for its aria-label */
const props = defineProps<{ staff: ArpeggioStaffModel; clef: 'treble' | 'bass'; intervals?: boolean; part?: Part; pickable?: boolean; rhythm?: RhythmId }>()
const emit = defineEmits<{ pick: [kind: PickKind, positions: readonly ChordAt[], value: number | readonly [number, number] | null] }>()

const pair = computed(() => props.staff.pair ?? null)
const caption = computed(() => (pair.value ? pairCaption(pair.value) : ''))
const canPick = computed(() => !!props.pickable && !!props.part && !!pair.value?.source && !!pair.value.hexatonic && pair.value.positions.length > 0)
const bars = computed(() => pickBars(pair.value?.positions ?? []))
const header = computed(() => (pair.value?.source && props.part ? pickHeader(pickHeading(props.part, pair.value.source.chord, pair.value.source.scale), bars.value) : ''))
const footer = computed(() => pickFooter('scales', bars.value, !!pair.value?.varies))
const choices = computed(() => (canPick.value ? hexatonicChoices(pair.value!.source!.chord, pair.value!.source!.scale, props.part!) : []))
const rows = computed((): readonly ChoiceRow[] => hexChoiceRows(choices.value, pair.value?.hexatonic?.name))
/** the caption in words, as the Scales sheet's Hexatonic caption says it; the popover adds ', your pick' */
const triggerLabel = computed((): string => {
  const h = pair.value?.hexatonic
  if (!h) return 'Triad pair: none'
  return `Triad pair: ${glyphs(h.name)}, covers ${pair.value?.coverage} chord tones${pair.value?.varies ? ', varies' : ''}`
})
function choose(id: string): void {
  const c = choices.value.find((x) => choiceId.hex(x.roots) === id)
  if (c && pair.value) emit('pick', 'hexatonic', pair.value.positions, c.roots)
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
    xs.value = drawArpeggioStaff(vf, el.value, props.staff, props.clef, props.rhythm && props.rhythm !== 'off' ? `Rhythm: ${rhythmLabel(props.rhythm)}` : null)
    drawError.value = null
  } catch (e) {
    drawError.value = `Couldn't draw this staff (${e instanceof Error ? e.message : String(e)})`
  } finally {
    done()
  }
}

onMounted(draw)
// a primitive key: re-parses create new staff objects, but only real changes should redraw
watch(() => `${props.staff.id}|${props.staff.last}|${props.clef}`, () => nextTick(draw))
</script>
