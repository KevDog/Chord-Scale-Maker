<template>
  <div class="space-y-8 print:space-y-0">
    <ul v-if="sheet.diagnostics.length" class="space-y-1 text-sm text-amber-700 print:hidden dark:text-amber-400">
      <li v-for="d in sheet.diagnostics" :key="d">{{ d }}</li>
    </ul>
    <SheetPage v-for="page in pages" :key="page.number" :title="title" :subtitle="subtitleText" :number="page.number" :total="pages.length" compact>
      <div class="space-y-6 print:space-y-1">
        <GuideToneSystem
          v-for="s in page.systems"
          :key="s.index"
          :system="s.system"
          :clef="part.clef"
          :first="s.index === 0"
          :last="s.index === sheet.systems.length - 1"
          :bars-per-system="barsPerSystem"
          :intervals="intervals"
        />
      </div>
    </SheetPage>
  </div>
</template>

<script setup lang="ts">
import { buildGuideTones, chunk, pageSubtitle, type Part, type Row } from '~~/engine'

/** both guide tone lines for the chart, in systems of 4 bars (2 on phones) and pages of 8 systems */
const props = defineProps<{
  rows: readonly Row[]
  title: string
  subtitle: string
  part: Part
  instrumentLabel: string // '' for concert
  intervals?: boolean
}>()

const SYSTEMS_PER_PAGE = 8

/** 4 bars a system, 2 on phones (print always gets 4) */
const wide = useMediaQuery('(min-width: 640px), print')
const barsPerSystem = computed(() => (wide.value ? 4 : 2))

const sheet = computed(() => buildGuideTones(props.rows, props.part, barsPerSystem.value))
const subtitleText = computed(() => pageSubtitle(props.subtitle, props.instrumentLabel, 'Guide Tone Lines'))
const pages = computed(() =>
  chunk(
    sheet.value.systems.map((system, index) => ({ system, index })),
    SYSTEMS_PER_PAGE,
  ).map((systems, i) => ({ number: i + 1, systems })),
)
</script>
