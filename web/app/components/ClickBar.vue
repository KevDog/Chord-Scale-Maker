<template>
  <!-- the click (#254): docked to the window's bottom on the song page, or a row of the focus bar in focus mode -->
  <div
    ref="root"
    role="toolbar"
    aria-label="Click"
    :class="[
      'flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden',
      home === 'docked' ? 'fixed inset-x-0 bottom-0 z-30 bg-raised px-4 py-2 shadow-raised' : 'relative', // positioned: on a phone the settings open across it
    ]"
  >
    <ToggleButton :model-value="click.running.value" @update:model-value="click.toggle()">
      <StopIcon v-if="click.running.value" data-slot="icon" /><PlayIcon v-else data-slot="icon" />{{ click.running.value ? 'Stop' : 'Start' }}
    </ToggleButton>
    <!-- folded (the chevron): Start/Stop, the tempo and the lights, one row, so a phone keeps its screen for the music -->
    <UiText v-if="folded" class="tabular-nums">{{ click.tempo.value }} bpm</UiText>
    <span v-if="!folded" class="flex items-center gap-1">
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
        @keydown.up.prevent="nudge(1, $event)"
        @keydown.down.prevent="nudge(-1, $event)"
      />
      <UiButton plain aria-label="Faster" title="Faster (Shift: 5)" @click="step(1, $event)"><PlusIcon data-slot="icon" /></UiButton>
    </span>
    <UiButton v-if="!folded" outline aria-label="Tap the tempo" title="Tap the beat a few times" @click="click.tap()">Tap</UiButton>
    <SegmentedControl v-if="!folded" v-model="click.feel.value" legend="Feel" :name="`click-feel-${home}`" :options="FEELS" />
    <!-- Hear line (#507): the Changes sheet's Line sounds with the click -->
    <ToggleButton v-if="!folded && hearOn && click.hasLine.value" v-model="hear" title="Play the Line on the sheet with the click">Hear line</ToggleButton>
    <!-- its settings beside the controls they qualify, not by Hide (the owner, #497) -->
    <RailPopover v-if="!folded" v-model:open="settingsOpen" label="Click settings" :place="home === 'docked' ? 'above' : 'below'">
      <SegmentedControl v-model="countIn" legend="Count-in" :name="`click-count-${home}`" :options="COUNT_INS" />
      <!-- Click on (Bergonzi 31): the beats the click sounds; a pattern the bar is too short for plays every beat -->
      <div class="flex items-center gap-2">
        <UiText>Click on</UiText>
        <UiListbox v-model="pattern" aria-label="Click on" class="min-w-36">
          <template #selected="{ value }"><UiListboxLabel>{{ PATTERN_LABELS[value as ClickPattern] }}</UiListboxLabel></template>
          <UiListboxOption v-for="p in patterns" :key="p" :value="p"><UiListboxLabel>{{ PATTERN_LABELS[p] }}</UiListboxLabel></UiListboxOption>
        </UiListbox>
      </div>
      <!-- the swing dial (#521): where Swing's 8th falls, from straight to a dotted 8th and a 16th -->
      <label v-if="hearOn && click.feel.value === 'swing'" class="flex items-center gap-2">
        <UiText>Swing</UiText>
        <input v-model.number="swingPercent" type="range" min="50" max="75" step="1" aria-label="Swing" class="w-32 accent-zinc-950 dark:accent-white">
        <UiText class="w-10 tabular-nums">{{ swingPercent }}%</UiText>
      </label>
      <UiCheckbox v-if="chart.beats === 4" v-model="hat">Hat on 2 &amp; 4</UiCheckbox>
      <!-- Hear rhythm (#521): the sheet's rhythm taps on a rim with the click -->
      <UiCheckbox v-if="hearOn && click.hasRhythm.value" v-model="hearRhythm">Hear rhythm</UiCheckbox>
      <!-- Hear changes (#508): a piano's voicings and a bass under the click -->
      <template v-if="harmonyOn && click.hasHarmony.value">
        <UiCheckbox v-model="piano">Piano</UiCheckbox>
        <SegmentedControl v-model="bass" legend="Bass" :name="`click-bass-${home}`" :options="BASSES" />
        <!-- the style's pattern set (#509): the piano comps, the bass walks, and Drums plays its kit -->
        <template v-if="click.grooveSet.value">
          <UiCheckbox v-model="groove">{{ GROOVE_LABELS[click.grooveSet.value] }} groove</UiCheckbox>
          <UiCheckbox v-if="groove" v-model="drums">Drums</UiCheckbox>
        </template>
      </template>
      <!-- practice tools (#509): each time through the form, the next key, or a little faster -->
      <template v-if="practiceOn && click.hasForm.value">
        <SegmentedControl v-model="keys" legend="All keys" :name="`click-keys-${home}`" :options="KEYS" />
        <SegmentedControl v-model="ramp" legend="Ramp" :name="`click-ramp-${home}`" :options="RAMPS" />
      </template>
      <!-- the mixer (#509): a level and a mute for each sound that plays, and the duo presets -->
      <div v-if="mixerOn" role="group" aria-label="Mix" class="space-y-2">
        <div v-if="harmonyOn && click.hasHarmony.value" class="flex items-center gap-2">
          <UiText>Mix</UiText>
          <UiListbox v-model="preset" aria-label="Mix" class="min-w-36">
            <template #selected="{ value }"><UiListboxLabel>{{ PRESET_LABELS[value as MixPreset | 'custom'] }}</UiListboxLabel></template>
            <UiListboxOption v-for="p in MIX_PRESETS" :key="p" :value="p"><UiListboxLabel>{{ PRESET_LABELS[p] }}</UiListboxLabel></UiListboxOption>
          </UiListbox>
        </div>
        <div v-for="t in mixTracks" :key="t" class="flex items-center gap-2">
          <UiText class="w-14">{{ TRACK_LABELS[t] }}</UiText>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            :value="Math.round(click.settings.value.mix[t].level * 100)"
            :aria-label="`${TRACK_LABELS[t]} level`"
            class="w-28 accent-zinc-950 dark:accent-white"
            @input="setTrack(t, { level: Number(($event.target as HTMLInputElement).value) / 100 })"
          >
          <UiCheckbox :model-value="click.settings.value.mix[t].mute" @update:model-value="setTrack(t, { mute: $event })">Mute<span class="sr-only"> {{ TRACK_LABELS[t] }}</span></UiCheckbox>
        </div>
      </div>
      <SegmentedControl v-model="sound" legend="Sound" :name="`click-sound-${home}`" :options="SOUNDS" />
    </RailPopover>
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
    <UiText v-else-if="!folded" class="min-w-0 truncate max-sm:order-last">{{ metreText }}</UiText>
    <UiText v-if="practiceOn && click.running.value && keys !== 'off'" role="status">{{ SHIFTS[click.shift.value + 6] }}</UiText>
    <span class="ml-auto flex items-center gap-1">
      <UiButton
        plain
        aria-label="Click controls"
        :aria-expanded="!folded"
        :title="folded ? 'Show all the click’s controls' : 'Fold the click to Start, the tempo and the beat'"
        @click="folded = !folded"
      >
        <component :is="(home === 'docked') === folded ? ChevronUpIcon : ChevronDownIcon" data-slot="icon" />
      </UiButton>
      <UiButton v-if="home === 'docked' && !folded" plain aria-label="Hide the click" title="Hide the click" @click="emit('hide')"><XMarkIcon data-slot="icon" /></UiButton>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon, ChevronUpIcon, MinusIcon, PlayIcon, PlusIcon, StopIcon, XMarkIcon } from '@heroicons/vue/16/solid'
import { CLICK_PATTERNS, type ClickFeel, type ClickPattern, clampTempo, type GrooveSet, type KeyCycle, MIX_PRESETS, type MixPreset, type MixTrack, patternFits, presetOf, type TrackMix, withPreset } from '@chord-scale-maker/engine'
import { CLICK, type Click, type ClickBass, type ClickChart, type ClickRamp, type ClickSettings } from '~/composables/useClick'
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

// the feel is what plays between the beats: nothing, swing's skip note, or straight eighths
const FEELS: readonly { value: ClickFeel; label: string }[] = [
  { value: 'quarters', label: 'Quarters' },
  { value: 'swing', label: 'Swing' },
  { value: 'straight', label: 'Straight' },
]
const COUNT_INS = [
  { value: '0', label: 'Off' },
  { value: '1', label: '1 bar' },
  { value: '2', label: '2 bars' },
] as const
const PATTERN_LABELS: Readonly<Record<ClickPattern, string>> = {
  all: 'Every beat',
  '2-4': '2 & 4',
  '1-3': '1 & 3',
  '3': '3 only',
  '4': '4 only',
  'and-2-4': 'The & of 2 & 4',
}
const patterns = computed(() => CLICK_PATTERNS.filter((p) => patternFits(p, props.chart.beats)))
// what plays: a pattern the bar is too short for shows as Every beat, as it sounds
const pattern = computed({
  get: (): ClickPattern => (patternFits(click.pattern.value, props.chart.beats) ? click.pattern.value : 'all'),
  set: (p: ClickPattern) => (click.pattern.value = p),
})
const BASSES: readonly { value: ClickBass; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'roots', label: 'Roots' },
  { value: 'two', label: 'Two-feel' },
]
const KEYS: readonly { value: KeyCycle; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'fourths', label: 'Up 4ths' },
  { value: 'half', label: 'Up ½ steps' },
]
const RAMPS = [
  { value: '0', label: 'Off' },
  { value: '2', label: '+2' },
  { value: '4', label: '+4' },
  { value: '8', label: '+8' },
] as const
// the chorus's key, from the written one: −6 to +5 semitones
const SHIFTS = ['A tritone away', 'Down a 4th', 'Down a major 3rd', 'Down a minor 3rd', 'Down a whole step', 'Down a half step', 'As written', 'Up a half step', 'Up a whole step', 'Up a minor 3rd', 'Up a major 3rd', 'Up a 4th']
const SOUNDS: readonly { value: ClickSound; label: string }[] = [
  { value: 'wood', label: 'Wood' },
  { value: 'beep', label: 'Beep' },
  { value: 'stick', label: 'Stick' },
]

const metreText = computed(() =>
  [[`${props.chart.beats}/4`, props.chart.style].filter(Boolean).join(' · '), props.chart.metreChanges && !click.hasForm.value ? 'meter changes play the main meter' : '']
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
function step(by: 1 | -1, e: MouseEvent | KeyboardEvent): void {
  click.tempo.value = clampTempo(click.tempo.value + by * (e.shiftKey ? 5 : 1))
}
// the field's arrows: from what's typed, by 1, or 5 with Shift, as − and + do
function nudge(by: 1 | -1, e: KeyboardEvent): void {
  commit(e)
  step(by, e)
}

const settingsOpen = ref(false)
function setting<K extends keyof ClickSettings>(key: K) {
  return computed({
    get: (): ClickSettings[K] => click.settings.value[key],
    set: (v: ClickSettings[K]) => (click.settings.value = { ...click.settings.value, [key]: v }),
  })
}
const hat = setting('hat')
const hear = setting('hear')
const hearRhythm = setting('hearRhythm')
const piano = setting('piano')
const groove = setting('groove')
const drums = setting('drums')
const GROOVE_LABELS: Readonly<Record<GrooveSet, string>> = { swing: 'Swing', ballad: 'Ballad', bossa: 'Bossa' }
const bass = setting('bass')
const mix = setting('mix')
const keys = setting('keys')
const rampSetting = setting('ramp')
const ramp = computed({
  get: (): '0' | '2' | '4' | '8' => String(rampSetting.value) as '0' | '2' | '4' | '8',
  set: (v: '0' | '2' | '4' | '8') => (rampSetting.value = Number(v) as ClickRamp),
})
const practiceOn = useFeature('practiceTools') && useFeature('hearLine')
const mixerOn = useFeature('mixer') && useFeature('hearLine')
const TRACK_LABELS: Readonly<Record<MixTrack, string>> = { click: 'Click', line: 'Line', rhythm: 'Rhythm', piano: 'Piano', bass: 'Bass', drums: 'Drums' }
const PRESET_LABELS: Readonly<Record<MixPreset | 'custom', string>> = { band: 'Band', 'piano-duo': 'Piano duo', 'bass-duo': 'Bass duo', 'no-piano': 'No piano', 'no-bass': 'No bass', custom: 'Your own' }
const preset = computed({
  get: (): MixPreset | 'custom' => presetOf(mix.value) ?? 'custom',
  set: (p: MixPreset | 'custom') => p !== 'custom' && (mix.value = withPreset(mix.value, p)),
})
// the sounds that play: the click, then each part that's on
const mixTracks = computed((): MixTrack[] => {
  const s = click.settings.value
  const harmony = harmonyOn && click.hasHarmony.value
  return [
    'click' as const,
    ...(hearOn && click.hasLine.value && s.hear ? ['line' as const] : []),
    ...(hearOn && click.hasRhythm.value && s.hearRhythm ? ['rhythm' as const] : []),
    ...(harmony && s.piano ? ['piano' as const] : []),
    ...(harmony && s.bass !== 'off' ? ['bass' as const] : []),
    ...(harmony && click.grooveSet.value && s.groove && s.drums ? ['drums' as const] : []),
  ]
})
function setTrack(t: MixTrack, change: Partial<TrackMix>): void {
  mix.value = { ...mix.value, [t]: { ...mix.value[t], ...change } }
}
const harmonyOn = useFeature('harmony') && useFeature('hearLine')
const swingPercent = computed({
  get: (): number => Math.round(click.swing.value * 100),
  set: (p: number) => (click.swing.value = p / 100),
})
const hearOn = useFeature('hearLine')
const folded = setting('folded')
const sound = setting('sound')
const countInSetting = setting('countIn')
const countIn = computed({
  get: (): '0' | '1' | '2' => String(countInSetting.value) as '0' | '1' | '2',
  set: (v: '0' | '1' | '2') => (countInSetting.value = Number(v) as 0 | 1 | 2),
})

// docked: the page's foot clears it, by its height (--click-h)
const root = useTemplateRef<HTMLElement>('root')
let sized: ResizeObserver | undefined
onMounted(() => {
  if (props.home !== 'docked') return
  document.body.classList.add('click-docked') // main.css: the room, and none in print
  if (!root.value || typeof ResizeObserver === 'undefined') return
  sized = new ResizeObserver(([e]) => {
    if (e) document.documentElement.style.setProperty('--click-h', `${Math.ceil(e.borderBoxSize[0]?.blockSize ?? e.contentRect.height)}px`)
  })
  sized.observe(root.value)
})
onBeforeUnmount(() => {
  sized?.disconnect()
  if (props.home !== 'docked') return
  document.body.classList.remove('click-docked')
  document.documentElement.style.removeProperty('--click-h')
})
</script>
