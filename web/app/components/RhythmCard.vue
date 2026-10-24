<template>
  <div v-if="card" ref="el" data-slot="rhythm-card" class="text-zinc-900 dark:text-zinc-100 print:text-black" />
</template>

<script setup lang="ts">
import { cardBars, type RhythmId, rhythmLabel } from '@chord-scale-maker/engine'

/**
 * A rhythm's card alone (#573): one cycle of `rhythm` in `beats`, cut after four bars, as the Scales staves' cards are
 * drawn. The Changes sheet shows it over its first line with the Line off, and the Rhythm control under its choice.
 * width: the card's, in staff units (a sheet staff is 1200), the element's width scaling it
 */
const props = withDefaults(defineProps<{ rhythm: RhythmId; beats: number; width?: number }>(), { width: 1199 })
const card = computed(() => (props.rhythm === 'off' ? null : cardBars(props.rhythm, props.beats)))
const el = useTemplateRef<HTMLDivElement>('el')

async function draw(): Promise<void> {
  const vf = await loadVexFlow()
  const c = card.value
  if (!el.value || !c) return
  drawRhythmCard(vf, el.value, c, props.width, (shown) => cardAria(rhythmLabel(props.rhythm), shown), props.width + 1)
}
onMounted(draw)
watch(() => `${props.rhythm}|${props.beats}|${props.width}`, () => nextTick(draw))
</script>
