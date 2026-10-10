<template>
  <div class="space-y-8 print:space-y-0">
    <ul v-if="sheet.diagnostics.length" class="space-y-1 text-sm text-amber-700 print:hidden dark:text-amber-400">
      <li v-for="d in sheet.diagnostics" :key="d">{{ d }}</li>
    </ul>
    <SheetPages :title="title" :composer="composer" :pages="pages" compact>
      <template #default="{ page }">
        <div class="space-y-6 print:space-y-1">
          <GuideToneSystem
            v-for="s in page.systems"
            :key="s.index"
            :system="s.system"
            :clef="part.clef"
            :first="s.index === 0"
            :last="s.index === sheet.systems.length - 1"
            :bars-per-system="barsPerSystem"
            :beats="sheet.beats"
            :intervals="intervals"
          />
        </div>
      </template>
    </SheetPages>
  </div>
</template>

<script setup lang="ts">
import { buildGuideTones, chunk, type Key, pageSubtitle, type Part, type Row } from '~~/engine'

/** both guide tone lines for the chart, in systems of 4 bars (2 on phones) and pages of 8 systems */
const props = defineProps<{
  rows: readonly Row[]
  title: string
  subtitle: string
  composer?: string
  part: Part
  instrumentLabel: string // '' for concert
  beats?: 2 | 3 | 4 // the chart's time signature, over 4
  intervals?: boolean
  keys?: readonly (Key | null)[] // each row's key, for the key signatures; none drawn without
}>()

const SYSTEMS_PER_PAGE = 8

/** 4 bars a system, 2 on phones (print always gets 4) */
const wide = useMediaQuery('(min-width: 640px), print')
const barsPerSystem = computed(() => (wide.value ? 4 : 2))

const sheet = computed(() => buildGuideTones(props.rows, props.part, barsPerSystem.value, props.beats ?? 4, props.keys))
const subtitleText = computed(() => pageSubtitle(props.subtitle, props.instrumentLabel, 'Guide Tone Lines'))
const pages = computed(() =>
  chunk(
    sheet.value.systems.map((system, index) => ({ system, index })),
    SYSTEMS_PER_PAGE,
  ).map((systems) => ({ subtitle: subtitleText.value, systems })),
)
</script>
