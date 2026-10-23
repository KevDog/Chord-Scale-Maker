<template>
  <div v-if="page" class="lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12">
    <!-- from lg: the text, and its index in a column beside it -->
    <article class="max-w-3xl space-y-10">
      <header>
        <p class="mb-2"><NuxtLink :to="CHORDS_PATH" class="text-sm/6 font-medium text-accent hover:underline">Chords</NuxtLink><span class="text-sm/6 text-zinc-500 dark:text-zinc-400"> · <ChordSymbol :tokens="page.symbolOnC" /></span></p>
        <UiHeading>{{ page.title }} chord</UiHeading>
        <UiText class="mt-1">{{ intro }}</UiText>
        <PageIndex :sections="SECTIONS" />
      </header>

      <section class="space-y-4" aria-labelledby="notes">
        <UiSubheading id="notes" class="scroll-mt-6">Notes</UiSubheading>
        <!-- each note under its degree, as the formula counts it from the root -->
        <ol :aria-label="`${page.title} on C`" class="flex flex-wrap gap-x-1 gap-y-3">
          <li v-for="(n, i) in notes" :key="i" class="flex w-12 flex-col items-center rounded-control bg-paper py-2 shadow-paper">
            <span class="font-display text-xl/7 font-semibold text-zinc-950 dark:text-white">{{ n.note }}</span>
            <span class="text-xs/4 text-zinc-500 tabular-nums dark:text-zinc-400"><span class="sr-only">, the </span>{{ n.degree }}</span>
          </li>
        </ol>
      </section>

      <section class="space-y-4" aria-labelledby="practice">
        <UiSubheading id="practice" class="scroll-mt-6">Practice it</UiSubheading>
        <UiText>Its default scale, with the chord tones lit.</UiText>
        <ClientOnly>
          <SheetRail>
            <template #left>
              <UiField class="w-64">
                <UiLabel class="pl-3">Instrument</UiLabel>
                <InstrumentPicker v-model="prefs.instrument.value" />
              </UiField>
              <UiField>
                <UiLabel class="pl-3">Spell Scale</UiLabel>
                <div class="flex items-center gap-2">
                  <UiListbox v-model="prefs.spell.value" class="w-40" aria-label="Where the scale starts">
                    <template #selected="{ value }"><UiListboxLabel>{{ spellLabel(value, keyStartNote) }}</UiListboxLabel></template>
                    <UiListboxOption v-for="s in SPELLS" :key="s" :value="s"><UiListboxLabel>{{ spellLabel(s, keyStartNote) }}</UiListboxLabel></UiListboxOption>
                  </UiListbox>
                </div>
              </UiField>
            </template>
          </SheetRail>
          <div class="mt-4 rounded-paper bg-paper p-4 shadow-paper sm:p-6">
            <ScaleStaff v-if="staff" :staff="staff" :clef="part.clef" :part="part" :intervals="prefs.intervals.value" stacked />
          </div>
          <template #fallback><UiText>Loading the staff…</UiText></template>
        </ClientOnly>
      </section>

      <section class="space-y-4" aria-labelledby="scales">
        <UiSubheading id="scales" class="scroll-mt-6">Scales</UiSubheading>
        <dl class="divide-y divide-zinc-950/5 dark:divide-white/5">
          <div v-for="s in page.scales" :key="s.source" class="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
            <dt class="w-56 text-sm/6 font-medium">
              <UiTextLink v-if="s.path" :href="s.path">{{ s.scale }}</UiTextLink>
              <template v-else>{{ s.scale }}</template>
            </dt>
            <dd class="flex flex-1 flex-wrap items-baseline gap-2 text-sm/6 text-zinc-600 dark:text-zinc-400">
              <UiBadge v-for="t in s.tags" :key="t" :color="t === 'default' ? 'note' : 'zinc'">{{ TAG_LABELS[t] }}</UiBadge>
              <span v-if="s.note">{{ s.note }}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="space-y-4" aria-labelledby="tunes">
        <UiSubheading id="tunes" class="scroll-mt-6">Tunes</UiSubheading>
        <template v-if="page.tunes.length">
          <ul class="gap-x-8 text-sm/7 sm:columns-2">
            <li v-for="t in page.tunes" :key="t.path" class="break-inside-avoid"><UiTextLink :href="t.path">{{ t.title }}</UiTextLink></li>
          </ul>
          <UiText v-if="page.more">and {{ page.more }} more.</UiText>
        </template>
        <UiText v-else>No library tune writes it yet.</UiText>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { buildSheet, keyStart, parseKey, partFor, type Row } from '@chord-scale-maker/engine'
import { type ChordScaleTag, chordHead, chordOnC, chordPage, CHORDS_PATH } from '~/utils/chordPage'
import { spellLabel, SPELLS, spellView } from '~/utils/scaleChoices'
import { seoMeta } from '~/utils/site'

/** a chord quality's reference page (/chords/<slug>, #498): its notes, a staff for your instrument, the scales it takes, and the library tunes that write it */
const route = useRoute()
const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
const page = chordPage(slug)
const head = chordHead(slug)
if (!page || !head) throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
useSeoMeta(seoMeta(head.head))
useHead({ script: [{ type: 'application/ld+json', innerHTML: head.ld }] })

const SECTIONS = [
  { id: 'notes', title: 'Notes' },
  { id: 'practice', title: 'Practice it' },
  { id: 'scales', title: 'Scales' },
  { id: 'tunes', title: 'Tunes' },
]
const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

const TAG_LABELS: Readonly<Record<ChordScaleTag, string>> = { default: 'Default', basic: 'Basic level', advanced: 'Advanced level', outside: 'Outside', functional: 'One function only' }

const notes = page.notes.split(' ').map((note, i) => ({ note, degree: page.formula.split(' ')[i] ?? '' }))
const COUNTS = ['', '', '', 'three', 'four', 'five', 'six']
const intro = `A ${COUNTS[notes.length] ?? notes.length}-note chord: its notes, a staff written for your instrument, the scales that play over it, and the library tunes that use it.`
const chord = chordOnC(page.quality)
const defaultScale = page.scales.find((s) => s.tags.includes('default'))?.source ?? page.scales[0]?.source ?? ''

const prefs = usePreferences()
const part = computed(() => partFor(prefs.instrument.value))
/** the written C for the part: the staff's "key" is the chord's own root */
const keyStartNote = computed(() => keyStart(parseKey('C'), part.value))
/** one staff: the chord's default scale on C, its chord tones lit */
const staff = computed(() => {
  const row: Row = { section: '', bar: '', chord, scale: defaultScale }
  const { mode, start } = spellView(prefs.spell.value, keyStartNote.value)
  return buildSheet([row], part.value, mode, start, 1, { preset: 'chordTones' })[0]?.pages[0]?.[0] ?? null
})
</script>
