<template>
  <!-- the click (#254): docked to the window's bottom on the song page, or a row of the focus bar in focus mode -->
  <div
    ref="root"
    role="toolbar"
    aria-label="Click"
    :class="[
      'flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden',
      home === 'docked' && 'fixed inset-x-0 bottom-0 z-30 bg-raised px-4 py-2 shadow-raised',
    ]"
  >
    <ToggleButton :model-value="click.running.value" @update:model-value="click.toggle()">
      <StopIcon v-if="click.running.value" data-slot="icon" /><PlayIcon v-else data-slot="icon" />{{ click.running.value ? 'Stop' : 'Start' }}
    </ToggleButton>
    <span class="flex items-center gap-1">
      <UiButton plain aria-label="Slower" title="Slower (Shift: 5)" @click="step(-1, $event)"><MinusIcon data-slot="icon" /></UiButton>
      <UiInput
        :model-value="String(click.tempo.value)"
        type="number"
        aria-label="Tempo"
        min="40"
        max="300"
        inputmode="numeric"
        class="w-18 text-center tabular-nums"
        @change="commit"
        @keydown.enter="commit"
      />
      <UiButton plain aria-label="Faster" title="Faster (Shift: 5)" @click="step(1, $event)"><PlusIcon data-slot="icon" /></UiButton>
    </span>
    <UiButton outline aria-label="Tap the tempo" title="Tap the beat a few times" @click="click.tap()">Tap</UiButton>
    <SegmentedControl v-model="click.feel.value" legend="Feel" :name="`click-feel-${home}`" :options="FEELS" />
    <span data-testid="click-lights" aria-hidden="true" class="flex items-center gap-1.5">
      <i
        v-for="n in chart.beats"
        :key="n"
        :data-on="click.beat.value === n - 1 ? '' : undefined"
        :data-count="click.beat.value === n - 1 && click.counting.value ? '' : undefined"
        :class="[
          'block rounded-full bg-zinc-300 transition-none data-on:bg-zinc-950 data-count:bg-amber-500 dark:bg-white/15 dark:data-on:bg-white dark:data-count:bg-amber-400',
          n === 1 ? 'size-3.5' : 'size-3',
        ]"
      />
    </span>
    <UiText v-if="click.unavailable.value" role="status" class="text-amber-800! dark:text-amber-400!">Sound isn’t available in this browser.</UiText>
    <UiText v-else class="min-w-0 truncate max-sm:order-last">{{ metreText }}</UiText>
    <span class="ml-auto flex items-center gap-1">
      <RailPopover v-model:open="settingsOpen" label="Click settings" :place="home === 'docked' ? 'above' : 'below'">
        <SegmentedControl v-model="countIn" legend="Count-in" :name="`click-count-${home}`" :options="COUNT_INS" />
        <UiCheckbox v-model="subdivision">{{ click.feel.value === 'swing' ? 'Skip note' : 'Eighths' }}</UiCheckbox>
        <UiCheckbox v-if="chart.beats === 4" v-model="hat">Hat on 2 &amp; 4</UiCheckbox>
        <SegmentedControl v-model="sound" legend="Sound" :name="`click-sound-${home}`" :options="SOUNDS" />
      </RailPopover>
      <UiButton v-if="home === 'docked'" plain aria-label="Hide the click" title="Hide the click" @click="emit('hide')"><XMarkIcon data-slot="icon" /></UiButton>
    </span>
  </div>
</template>

<script setup lang="ts">
import { MinusIcon, PlayIcon, PlusIcon, StopIcon, XMarkIcon } from '@heroicons/vue/16/solid'
import { type ClickFeel, clampTempo } from '@chord-scale-maker/engine'
import { CLICK, type Click, type ClickChart, type ClickSettings } from '~/composables/useClick'
import type { ClickSound } from '~/utils/clickSounds'

/**
 * the click's controls (#254): Start/Stop, the tempo (−, the number, +, Tap), the feel, a light per beat, and its
 * settings under ⋯, for the click provided (CLICK). docked: fixed to the window's bottom, its height in --click-h so the page clears it; focus: inline.
 */
const props = defineProps<{ home: 'docked' | 'focus'; chart: ClickChart }>()
const click: Click = inject(CLICK) ?? missing()
function missing(): never {
  throw new Error('ClickBar needs a click provided (CLICK)')
}
const emit = defineEmits<{ hide: [] }>()

const FEELS: readonly { value: ClickFeel; label: string }[] = [
  { value: 'swing', label: 'Swing' },
  { value: 'straight', label: 'Straight' },
]
const COUNT_INS = [
  { value: '0', label: 'Off' },
  { value: '1', label: '1 bar' },
  { value: '2', label: '2 bars' },
] as const
const SOUNDS: readonly { value: ClickSound; label: string }[] = [
  { value: 'wood', label: 'Wood' },
  { value: 'beep', label: 'Beep' },
]

const metreText = computed(() =>
  [[`${props.chart.beats}/4`, props.chart.style].filter(Boolean).join(' · '), props.chart.metreChanges ? 'metre changes play the main metre' : '']
    .filter(Boolean)
    .join(' · '),
)

// the number field shows the tempo; what's typed is taken on Enter or leaving it, and a bad entry snaps back
function commit(e: Event): void {
  const el = e.target as HTMLInputElement
  const text = el.value.trim()
  if (text !== '' && !Number.isNaN(Number(text))) click.tempo.value = clampTempo(Number(text))
  el.value = String(click.tempo.value)
}
function step(by: 1 | -1, e: MouseEvent): void {
  click.tempo.value = clampTempo(click.tempo.value + by * (e.shiftKey ? 5 : 1))
}

const settingsOpen = ref(false)
function setting<K extends keyof ClickSettings>(key: K) {
  return computed({
    get: (): ClickSettings[K] => click.settings.value[key],
    set: (v: ClickSettings[K]) => (click.settings.value = { ...click.settings.value, [key]: v }),
  })
}
const subdivision = setting('subdivision')
const hat = setting('hat')
const sound = setting('sound')
const countInSetting = setting('countIn')
const countIn = computed({
  get: (): '0' | '1' | '2' => String(countInSetting.value) as '0' | '1' | '2',
  set: (v: '0' | '1' | '2') => (countInSetting.value = Number(v) as 0 | 1 | 2),
})

// docked: how far the page's foot must clear it
const root = useTemplateRef<HTMLElement>('root')
let sized: ResizeObserver | undefined
onMounted(() => {
  if (props.home !== 'docked' || !root.value || typeof ResizeObserver === 'undefined') return
  sized = new ResizeObserver(([e]) => {
    if (e) document.documentElement.style.setProperty('--click-h', `${Math.ceil(e.borderBoxSize[0]?.blockSize ?? e.contentRect.height)}px`)
  })
  sized.observe(root.value)
})
onBeforeUnmount(() => {
  sized?.disconnect()
  if (props.home === 'docked') document.documentElement.style.removeProperty('--click-h')
})
</script>
