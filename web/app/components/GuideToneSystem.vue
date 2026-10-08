<template>
  <div class="grid grid-cols-1 gap-x-3 break-inside-avoid sm:grid-cols-[4.5rem_1fr] print:grid-cols-[4rem_1fr]">
    <!-- chord symbols over their beats, with the section and bar where a bar starts a chord -->
    <div class="max-sm:hidden print:block" />
    <div class="relative h-10 print:h-5">
      <template v-for="c in chordMarks" :key="c.key">
        <div class="absolute bottom-0 whitespace-nowrap" :style="{ left: `${c.x * 100}%` }">
          <div v-if="c.label" class="text-[0.65rem] text-zinc-500 dark:text-zinc-400 print:text-[0.55rem]/3 print:text-neutral-600">{{ c.label }}</div>
          <div class="text-base font-semibold print:text-sm/4"><ChordSymbol v-if="c.tokens" :tokens="c.tokens" /><span v-else>{{ c.text }}</span></div>
        </div>
      </template>
    </div>

    <template v-for="l in [0, 1] as const" :key="l">
      <div class="text-xs leading-tight text-zinc-500 sm:self-center sm:text-right dark:text-zinc-400 print:self-center print:text-right print:text-neutral-600">
        Line {{ l + 1 }}<br class="max-sm:hidden print:inline"><span class="text-[0.65rem]"><span class="sm:hidden print:hidden"> · </span>from the {{ l === 0 ? '3rd' : '7th' }}</span>
      </div>
      <div>
        <div :ref="(el) => setEl(l, el)" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
        <p v-if="intervals && labelsFor(l).length" class="relative h-4 text-xs/4 text-zinc-600 tabular-nums dark:text-zinc-400 print:hidden">
          <span class="sr-only">Guide tones:</span>
          <span v-for="(m, i) in labelsFor(l)" :key="i" class="absolute -translate-x-1/2" :style="{ left: `${m.x * 100}%` }">{{ m.label }}</span>
        </p>
      </div>
    </template>
    <p v-if="drawError" class="col-span-2 rounded border border-dashed border-amber-500 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">{{ drawError }}</p>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import { glyphs, type GuideSystem } from '~~/engine'

/** one guide tone system: chord symbols, then line 1 and line 2 on their own staves, bars aligned */
const props = defineProps<{
  system: GuideSystem
  clef: 'treble' | 'bass'
  first: boolean // gets the time signature
  last: boolean // gets the final bar line
  barsPerSystem: number
  beats?: 2 | 3 | 4 // the time signature, over 4
  intervals?: boolean // label each note (3, b7…), on screen only
}>()

const els: [HTMLElement | null, HTMLElement | null] = [null, null]
function setEl(l: 0 | 1, el: Element | ComponentPublicInstance | null): void {
  els[l] = el instanceof HTMLElement ? el : null
}
const xs = ref<readonly (readonly (readonly number[])[])[]>([[], []])
const drawError = ref<string | null>(null)

const labelsFor = (l: 0 | 1): { x: number; label: string }[] =>
  props.system.bars.flatMap((bar, b) =>
    bar.lines[l].flatMap((n, i) => {
      const struck = n.pitch && !(i === 0 ? props.system.bars[b - 1]?.lines[l].at(-1)?.tie : bar.lines[l][i - 1]?.tie)
      const x = xs.value[l]?.[b]?.[i]
      return struck && x !== undefined ? [{ x, label: glyphs(n.label) }] : []
    }),
  )

/** each chord sits over the line 1 note (or rest) that starts on its beat */
const chordMarks = computed(() =>
  props.system.bars.flatMap((bar, b) => {
    const starts = bar.lines[0].reduce<number[]>((acc, n, i) => [...acc, i === 0 ? 0 : (acc[i - 1] ?? 0) + (bar.lines[0][i - 1]?.beats ?? 0)], [])
    return bar.chords.flatMap((c, k) => {
      const i = starts.indexOf(c.beat)
      const x = xs.value[0]?.[b]?.[i]
      return x === undefined ? [] : [{ key: `${b}-${k}`, x: Math.max(0, x - 0.012), tokens: c.tokens, text: c.text, label: k === 0 ? bar.label : '' }]
    })
  }),
)

async function draw(): Promise<void> {
  const [a, b] = els
  if (!a || !b) return
  try {
    const vf = await loadVexFlow()
    xs.value = drawGuideToneSystem(vf, [a, b], props.system, props.clef, {
      timeSignature: props.first,
      finalBar: props.last,
      barsPerSystem: props.barsPerSystem,
      beats: props.beats ?? 4,
    }).xs
    drawError.value = null
  } catch (e) {
    drawError.value = `Couldn't draw these bars (${e instanceof Error ? e.message : String(e)})`
  }
}

onMounted(draw)
watch(() => [props.system, props.clef, props.first, props.last, props.beats], () => nextTick(draw))
</script>
