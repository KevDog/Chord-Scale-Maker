<template>
  <div class="break-inside-avoid">
    <!-- section markers and key areas, then chord symbols, over their beats -->
    <div class="relative h-12 print:h-7">
      <template v-for="m in marks" :key="m.key">
        <div class="absolute bottom-0 whitespace-nowrap" :style="{ left: `${m.x * 100}%` }">
          <ChangesMarks v-if="m.segno || m.coda || m.nav" :segno="m.segno" :coda="m.coda" :nav="m.nav" />
          <div v-if="m.marker || m.keyArea" class="flex items-baseline gap-2 text-[0.65rem] print:text-[0.55rem]/3">
            <span v-if="m.marker" class="rounded-sm border border-zinc-400 px-1 font-semibold text-zinc-700 dark:border-zinc-500 dark:text-zinc-300 print:border-neutral-600 print:text-black">{{ m.marker }}</span>
            <span v-if="m.keyArea" class="text-note-800 italic dark:text-note-300 print:text-neutral-700">{{ m.keyArea }}</span>
          </div>
          <div class="text-base font-semibold print:text-sm/4"><ChordSymbol v-if="m.tokens" :tokens="m.tokens" /><span v-else>{{ m.text }}</span></div>
        </div>
      </template>
      <span v-for="r in repeats" :key="`r${r.key}`" class="absolute bottom-0 -translate-x-full text-xs font-semibold text-zinc-600 dark:text-zinc-400 print:text-black" :style="{ left: `${r.x * 100}%` }">×{{ r.times }}</span>
    </div>
    <div ref="el" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
    <!-- the analysis under each chord: its numeral, then its scale -->
    <div v-if="numerals" class="relative h-5 print:h-3.5">
      <span v-for="m in marks" :key="`n${m.key}`" class="absolute truncate text-sm font-medium text-zinc-800 dark:text-zinc-200 print:text-xs/3.5 print:text-black" :style="{ left: `${m.x * 100}%`, maxWidth: `${m.room * 100}%` }" :title="m.numeral">{{ m.numeral }}</span>
    </div>
    <div v-if="scales" class="relative h-8 print:h-6">
      <span v-for="m in marks" :key="`s${m.key}`" class="absolute pr-1 text-[0.7rem]/3.5 text-zinc-600 dark:text-zinc-400 print:text-[0.6rem]/3 print:text-neutral-700" :style="{ left: `${m.x * 100}%`, maxWidth: `${m.room * 100}%` }">{{ m.scale }}</span>
    </div>
    <p v-if="drawError" class="rounded border border-dashed border-amber-500 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{{ drawError }}</p>
  </div>
</template>

<script setup lang="ts">
import type { ChangesLine } from '~~/engine'
import { drawChangesLine } from '~/utils/changesDrawing'

/** one line of the Changes sheet: slashes, the chords over them and the analysis under them */
const props = defineProps<{
  line: ChangesLine
  first: boolean // gets the time signature
  beats: 2 | 3 | 4
  barsPerLine: number
  numerals: boolean
  scales: boolean
}>()

const el = ref<HTMLElement | null>(null)
const xs = ref<readonly (readonly number[])[]>([])
const drawError = ref<string | null>(null)
const rendering = useRendering()

/**
 * each chord over the slash of its beat (markers and key areas ride on a bar's first chord, or its first beat), with
 * the room up to the next one, which its numeral and scale wrap within
 */
const marks = computed(() => {
  const all = props.line.bars.flatMap((bar, b) => {
    const at = (beat: number): number => Math.max(0, (xs.value[b]?.[beat] ?? 0) - 0.012)
    const chords = bar.chords.map((c, k) => ({ key: `${b}-${k}`, x: at(c.beat), tokens: c.tokens, text: c.text, numeral: c.numeral, scale: c.scale, marker: k === 0 ? bar.marker : '', keyArea: k === 0 ? bar.keyArea : '', segno: k === 0 && bar.segno, coda: k === 0 && bar.coda, nav: k === 0 ? bar.nav : '' }))
    if (!chords.length && (bar.marker || bar.keyArea || bar.segno || bar.coda || bar.nav)) return [{ key: `${b}-m`, x: at(0), tokens: null, text: '', numeral: '', scale: null, marker: bar.marker, keyArea: bar.keyArea, segno: bar.segno, coda: bar.coda, nav: bar.nav }]
    return chords
  })
  return all.map((m, i) => ({ ...m, room: Math.max(0.05, (all[i + 1]?.x ?? 1) - m.x) }))
})
/** "×3" over a repeat that plays more than twice */
const repeats = computed(() =>
  props.line.bars.flatMap((bar, b) => (bar.repeatEnd > 2 ? [{ key: b, x: Math.min(1, (xs.value[b]?.at(-1) ?? 1) + 0.03), times: bar.repeatEnd }] : [])),
)

async function draw(): Promise<void> {
  if (!el.value) return
  const done = rendering.begin()
  try {
    const vf = await loadVexFlow()
    xs.value = drawChangesLine(vf, el.value, props.line, { timeSignature: props.first, beats: props.beats, barsPerLine: props.barsPerLine }).xs
    drawError.value = null
  } catch (e) {
    drawError.value = `Couldn't draw these bars (${e instanceof Error ? e.message : String(e)})`
  } finally {
    done()
  }
}

onMounted(draw)
watch(() => [props.line, props.first, props.beats, props.barsPerLine], () => nextTick(draw))
</script>
