<template>
  <div class="lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12">
    <article class="max-w-3xl space-y-10">
      <header>
        <UiHeading>Chords</UiHeading>
        <UiText class="mt-1">Every chord quality the app reads, by family: its formula, and a page with its notes, the scales that play over it and the library tunes that use it.</UiText>
        <PageIndex :sections="SECTIONS" />
      </header>
      <section v-for="g in GROUPS" :key="g.id" class="space-y-3" :aria-labelledby="g.id">
        <UiSubheading :id="g.id" class="scroll-mt-6">{{ g.title }}</UiSubheading>
        <dl class="divide-y divide-zinc-950/5 dark:divide-white/5">
          <div v-for="c in g.chords" :key="c.path" class="flex flex-wrap items-baseline justify-between gap-x-6 py-2">
            <dt class="flex items-baseline gap-3 text-sm/6 font-medium">
              <UiTextLink :href="c.path">{{ c.title }}</UiTextLink>
              <span class="font-display text-zinc-600 dark:text-zinc-400"><ChordSymbol :tokens="c.symbol" /></span>
            </dt>
            <dd class="text-sm/6 text-zinc-600 tabular-nums dark:text-zinc-400">{{ c.formula }}</dd>
          </div>
        </dl>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { CONCERT, chordFormula, chordTitle, chordTokens, glyphs } from '@chord-scale-maker/engine'
import { CHORD_GROUPS, chordOnC, chordQualityPath } from '~/utils/chordPage'
import { PAGE_HEAD, seoMeta } from '~/utils/site'

/** /chords: every chord quality, by family, each linking to its page */
const GROUPS = CHORD_GROUPS.map((g, i) => ({
  id: `group-${i + 1}`,
  title: g.title,
  chords: g.qualities.map((q) => ({ path: chordQualityPath(q), title: chordTitle(q), symbol: chordTokens(CONCERT, chordOnC(q)), formula: glyphs(chordFormula(q)) })),
}))
const SECTIONS = GROUPS.map((g) => ({ id: g.id, title: g.title }))
const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD.chords))
</script>
