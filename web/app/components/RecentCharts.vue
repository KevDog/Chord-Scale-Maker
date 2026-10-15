<template>
  <section v-if="rows.length" aria-labelledby="recent-heading">
    <h2 id="recent-heading" class="text-xs/4 font-medium text-zinc-500 dark:text-zinc-400">Recently opened</h2>
    <ul class="mt-3 divide-y divide-zinc-950/5 rounded-paper bg-paper py-1 shadow-paper dark:divide-white/5">
      <li v-for="r in rows" :key="r.href" class="group relative grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 max-sm:px-4">
        <span class="min-w-0">
          <!-- the whole row is the link's target -->
          <a :href="r.href" class="text-[15px]/6 font-semibold text-zinc-900 group-hover:text-accent after:absolute after:inset-0 dark:text-white">{{ r.title }}</a>
          <UiBadge v-if="r.mine" color="note" class="ml-2">Mine</UiBadge>
          <span v-if="r.composer" class="block truncate text-[13px]/5 text-zinc-500 dark:text-zinc-400">{{ r.composer }}</span>
        </span>
        <span class="text-xs whitespace-nowrap text-zinc-400 tabular-nums dark:text-zinc-500">{{ r.when }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { findChart } from '~/utils/library'
import { loadRecent, openedWhen } from '~/utils/recentCharts'
import { songPath } from '~/utils/site'

/** the home page's recently opened charts, from this browser (utils/recentCharts.ts); nothing until it has some */
type Row = Readonly<{ href: string; title: string; composer: string; mine: boolean; when: string }>

const rows = ref<Row[]>([])

onMounted(() => {
  const now = Date.now()
  const mine = listCharts()
  rows.value = loadRecent().flatMap((r): Row[] => {
    const when = openedWhen(r.at, now)
    if (r.kind === 'library') {
      const c = findChart(r.id)
      return c ? [{ href: songPath(c.slug), title: c.title, composer: c.composer, mine: false, when }] : []
    }
    const c = mine.find((m) => m.id === r.id) // deleted since: dropped
    return c ? [{ href: `/song?mine=${c.id}`, title: c.title, composer: '', mine: true, when }] : []
  })
})
</script>
