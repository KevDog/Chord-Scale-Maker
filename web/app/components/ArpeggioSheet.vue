<template>
  <SheetPages :title="title" :composer="composer" :pages="pages">
    <template #default="{ page }">
      <div class="space-y-1 print:space-y-2">
        <ArpeggioStaff v-for="s in page.staves" :key="s.id" :staff="s" :clef="part.clef" :intervals="intervals" />
      </div>
    </template>
  </SheetPages>
</template>

<script setup lang="ts">
import { type ArpDirection, type ArpNotes, buildArpeggioSheet, type Key, pageSubtitle, type Part, type Resolved, type Row } from '@chord-scale-maker/engine'

const props = defineProps<{
  rows: readonly Row[]
  title: string
  subtitle: string
  composer?: string
  part: Part
  instrumentLabel: string
  perPage: number
  notes: ArpNotes
  dir: ArpDirection
  intervals?: boolean
  homeKey?: Key | null
  resolved?: ReadonlyMap<number, Resolved>
}>()

/** every printed page, in order, with its heading */
const pages = computed(() => {
  const sheet = buildArpeggioSheet(props.rows, props.part, props.perPage, props.notes, props.dir, props.homeKey, props.resolved)
  return sheet.pages.map((staves) => ({ staves, subtitle: pageSubtitle(props.subtitle, props.instrumentLabel, sheet.heading) }))
})
</script>
