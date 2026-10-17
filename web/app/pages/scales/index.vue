<template>
  <div class="lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12">
    <article class="max-w-3xl space-y-10">
      <header>
        <UiHeading>Scales</UiHeading>
        <UiText class="mt-1">Every scale the app plays, by family: its formula, and a page with its notes, the chords it plays over and the library tunes that use it.</UiText>
        <PageIndex :sections="SECTIONS" />
      </header>
      <section v-for="g in GROUPS" :key="g.id" class="space-y-3" :aria-labelledby="g.id">
        <UiSubheading :id="g.id" class="scroll-mt-6">{{ g.title }}</UiSubheading>
        <dl class="divide-y divide-zinc-950/5 dark:divide-white/5">
          <div v-for="s in g.scales" :key="s.path" class="flex flex-wrap items-baseline justify-between gap-x-6 py-2">
            <dt class="text-sm/6 font-medium"><UiTextLink :href="s.path">{{ s.title }}</UiTextLink></dt>
            <dd class="text-sm/6 text-zinc-600 tabular-nums dark:text-zinc-400">{{ s.formula }}</dd>
          </div>
        </dl>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { glyphs, SCALES, scaleTitle } from '@chord-scale-maker/engine'
import { SCALE_GROUPS } from '~/utils/scaleGroups'
import { PAGE_HEAD, seoMeta } from '~/utils/site'
import { scaleKeyPath } from '~/utils/scalePage'

/** /scales: every scale, by family, each linking to its page */
const GROUPS = SCALE_GROUPS.map((g, i) => ({
  id: `group-${i + 1}`,
  title: g.title,
  scales: g.scales.map((k) => ({ path: scaleKeyPath(k), title: scaleTitle(k), formula: glyphs(SCALES[k][0]) })),
}))
const SECTIONS = GROUPS.map((g) => ({ id: g.id, title: g.title }))
const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD.scales))
</script>
