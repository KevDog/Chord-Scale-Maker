<template>
  <ClientOnly>
    <div v-if="source.kind === 'missing'" class="max-w-xl space-y-4">
      <UiHeading>That chart isn’t here</UiHeading>
      <UiText>It isn’t saved in this browser. Saved charts stay in the browser they were made in; on another device, open it from a share link or a downloaded file.</UiText>
      <UiButton color="note" href="/">Go to the chart library</UiButton>
    </div>
    <div v-else-if="source.kind === 'badLink'" class="max-w-xl space-y-4">
      <UiHeading>That link doesn’t open a chart</UiHeading>
      <UiText>It may have been cut short when it was copied or sent. Ask for it again, or for the chart as a downloaded file.</UiText>
      <UiButton color="note" href="/">Go to the chart library</UiButton>
    </div>
    <!-- keyed by the chart being edited: another chart, or a revert, starts a fresh editor -->
    <EditorView
      v-else
      :key="editorKey"
      :initial-text="source.text"
      :practice-key="source.practiceKey"
      :save-target="source.target"
      :library-title="source.libraryTitle"
      :shared="source.shared"
      :is-new="source.target?.kind === 'new'"
      @created="adopt"
      @reload="reload"
    />
    <template #fallback>
      <div v-if="song" class="space-y-1">
        <UiHeading>{{ song.title }}</UiHeading>
        <UiText v-if="song.composer">{{ song.composer }}</UiText>
        <UiText>Loading the practice sheets…</UiText>
      </div>
      <p v-else class="text-zinc-600 dark:text-zinc-400">Loading editor…</p>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta } from '~/utils/site'
import { songHead } from '~/utils/songHead'
import { chartHeading, decodeShare, parseChart, type ShareView } from '@chord-scale-maker/engine'
import type { SaveTarget } from '~/composables/useSavedChart'

/**
 * The editor's chart and where it saves:
 * - /song/<name>: a library chart, or your edited version of it (My charts); /song?chart=<name> and
 *   /song/<old_name> move there
 * - ?mine=<id>: one of your saved charts
 * - ?new=1: a blank chart, saved on its first edit (the address then becomes ?mine=<id>)
 * - #s=<payload>: a share link (engine/src/share.ts): the chart and its view, not saved until you save it
 * Without the myCharts feature only library charts open, and nothing is saved.
 */
type Source =
  | Readonly<{ kind: 'chart'; text: string; practiceKey?: string; target?: SaveTarget; libraryTitle?: string; shared?: ShareView }>
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'badLink' }>

const route = useRoute()
const router = useRouter()
const myCharts = useFeature('myCharts')
const query = (name: string): string => (typeof route.query[name] === 'string' ? (route.query[name] as string) : '')
/** the library chart in the address: /song/<name>, or an old /song?chart=<name> */
const slug = (): string => chartSlug(typeof route.params.slug === 'string' ? route.params.slug : query('chart'))
const generation = ref(0)
/** the id our own first save put in the address: the editor stays as it is */
let adopted = ''

/** a share link's chart: undefined without one, null if it's damaged */
const hash = import.meta.client ? (route.hash || (useNuxtApp().$arrivalHash as string | undefined) || location.hash) : ''
const link = myCharts && hash.startsWith('#s=') ? await decodeShare(hash.slice(3)) : undefined

/** a library chart's other addresses (and a stray ?mine=) move to its own, the hash kept (the router may have dropped it, see `hash`) */
const atOwnAddress = (): boolean => !findChart(slug()) || (route.path === songPath(slug()) && route.query.mine === undefined)
const moveToOwnAddress = () => navigateTo({ path: songPath(slug()), hash }, { replace: true })

// without My charts the editor only opens library charts, and with it a bare /song has nothing to open (not on the
// prerender, which has no query)
if (import.meta.client) {
  if (!atOwnAddress()) await moveToOwnAddress()
  else if (!findChart(slug()) && (route.params.slug || !myCharts || (!query('mine') && route.query.new === undefined && link === undefined)))
    await navigateTo('/', { replace: true })
}
if (import.meta.client && myCharts) migrateDraft(STARTER_CHART)
// the page stays mounted when only the query changes (and while it hydrates the router briefly shows a bare /song, so a
// ?chart= or stray ?mine= is often only seen here)
if (import.meta.client) watch(() => [route.query.chart, route.query.mine], () => atOwnAddress() || moveToOwnAddress())

const source = computed((): Source => {
  void generation.value // a revert reads storage again
  const chart = slug()
  const library = findChart(chart)
  if (library) {
    if (!myCharts) return { kind: 'chart', text: library.text, practiceKey: chart }
    const version = versionOf(chart)
    const saved = version ? loadChart(version.id) : null
    const target: SaveTarget = { kind: 'library', slug: chart, libraryText: library.text, ...(saved ? { id: saved.meta.id } : {}) }
    return { kind: 'chart', text: saved?.text ?? library.text, practiceKey: chart, target, libraryTitle: library.title }
  }
  const mine = query('mine')
  if (mine) {
    const saved = loadChart(mine)
    return saved ? { kind: 'chart', text: saved.text, practiceKey: `mine:${mine}`, target: { kind: 'mine', id: mine } } : { kind: 'missing' }
  }
  if (route.query.new === undefined && link === null) return { kind: 'badLink' }
  if (route.query.new === undefined && link) return { kind: 'chart', text: link.chart, shared: link.view ?? {} }
  const id = newChartId()
  return { kind: 'chart', text: STARTER_CHART, practiceKey: `mine:${id}`, target: { kind: 'new', id, savedKind: 'new' } }
})

const editorKey = ref(`${route.fullPath}#0`)
watch(
  () => route.fullPath,
  (path) => {
    if (adopted && query('mine') === adopted) return
    adopted = ''
    editorKey.value = `${path}#${generation.value}`
  },
)

/** a new chart was saved: give it its address without restarting the editor */
function adopt(id: string): void {
  adopted = id
  router.replace({ path: '/song', query: { mine: id } })
}

function reload(): void {
  generation.value++
  editorKey.value = `${route.fullPath}#${generation.value}`
}

// the library head only at the clean address; null for /song, ?mine=, ?new=1, share links and old underscore addresses
const song = route.path.replace(/\/$/, '') === songPath(slug()) ? songHead(slug()) : null
useSeoMeta(seoMeta(song?.head ?? PAGE_HEAD.song))
if (song) useHead({ script: [{ type: 'application/ld+json', innerHTML: song.ld }] })
// in the browser, the tab and history name the chart ("Blue Trane · Chord Scale Maker"); the prerender has none
const chartTitle = computed(() => (import.meta.client && source.value.kind === 'chart' ? chartHeading(parseChart(source.value.text).value).title : ''))
useHead({ title: () => chartTitle.value || (song?.head ?? PAGE_HEAD.song).title })
</script>
