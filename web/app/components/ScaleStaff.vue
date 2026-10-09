<template>
  <div class="grid grid-cols-[8rem_1fr] items-center gap-3 break-inside-avoid print:grid-cols-[8.5rem_1fr]">
    <div class="text-right leading-tight">
      <div class="text-xs text-zinc-500 dark:text-zinc-400 print:text-neutral-600">{{ staff.section }} · Bar {{ staff.bar }}</div>
      <div class="text-lg font-semibold"><ChordSymbol v-if="staff.chord" :tokens="staff.chord" /><span v-else>—</span></div>
      <div v-if="staff.scale" class="whitespace-nowrap text-sm italic"><NoteName :note="staff.scale.root" /> {{ staff.scale.name }}</div>
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
import { glyphs, type StaffModel } from '~~/engine'

/** intervals: label each note against the chord root (b9, #11…) */
const props = defineProps<{ staff: StaffModel; clef: 'treble' | 'bass'; intervals?: boolean }>()
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
watch(() => `${props.staff.id}|${props.staff.last}|${props.clef}|${props.staff.selected?.join() ?? ''}`, () => nextTick(draw))
</script>
