<template>
  <div class="space-y-8 print:space-y-0">
    <ul v-if="sheet.diagnostics.length" class="space-y-1 text-sm text-amber-700 print:hidden dark:text-amber-400">
      <li v-for="d in sheet.diagnostics" :key="d">{{ d }}</li>
    </ul>
    <section
      v-for="page in pages"
      :key="page.number"
      class="rounded-xl bg-white p-6 shadow-xs ring-1 ring-zinc-950/10 dark:bg-zinc-950 dark:ring-white/10 print:break-after-page print:last:break-after-auto print:rounded-none print:bg-white print:p-0 print:shadow-none print:ring-0"
    >
      <header class="mb-4 text-center print:mb-1">
        <h2 class="text-xl/8 font-semibold text-zinc-950 dark:text-white print:text-black">{{ title }}</h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400 print:text-zinc-700">{{ subtitleText }}</p>
      </header>
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
      <p class="mt-3 text-right text-xs text-zinc-500 print:hidden dark:text-zinc-400">Page {{ page.number }} of {{ pages.length }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { buildGuideTones, pageSubtitle, type Part, type Row } from '~~/engine'

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
const wide = ref(true)
let query: MediaQueryList | undefined
const update = (): void => {
  wide.value = query?.matches ?? true
}
onMounted(() => {
  query = window.matchMedia('(min-width: 640px), print')
  update()
  query.addEventListener('change', update)
})
onBeforeUnmount(() => query?.removeEventListener('change', update))
const barsPerSystem = computed(() => (wide.value ? 4 : 2))

const sheet = computed(() => buildGuideTones(props.rows, props.part, barsPerSystem.value))
const subtitleText = computed(() => pageSubtitle(props.subtitle, props.instrumentLabel, 'Guide Tone Lines'))
const pages = computed(() => {
  const systems = sheet.value.systems.map((system, index) => ({ system, index }))
  const out: { number: number; systems: typeof systems }[] = []
  for (let i = 0; i < systems.length; i += SYSTEMS_PER_PAGE) out.push({ number: out.length + 1, systems: systems.slice(i, i + SYSTEMS_PER_PAGE) })
  return out
})
</script>
