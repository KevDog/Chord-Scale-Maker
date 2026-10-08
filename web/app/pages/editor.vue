<template>
  <ClientOnly>
    <div v-if="source.kind === 'missing'" class="max-w-xl space-y-4">
      <UiHeading>That chart isn’t here</UiHeading>
      <UiText>It isn’t saved in this browser. Saved charts stay in the browser they were made in; on another device, open it from a share link or a downloaded file.</UiText>
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
      @created="adopt"
      @reload="reload"
    />
    <template #fallback><p class="text-zinc-500">Loading editor…</p></template>
  </ClientOnly>
</template>

<script setup lang="ts">
import type { SaveTarget } from '~/composables/useSavedChart'

/**
 * The editor's chart and where it saves:
 * - ?chart=<slug>: a library chart, or your edited version of it (My charts)
 * - ?mine=<id>: one of your saved charts
 * - ?new=1: a blank chart, saved on its first edit (the address then becomes ?mine=<id>)
 * Without the myCharts feature only library charts open, and nothing is saved.
 */
type Source =
  | Readonly<{ kind: 'chart'; text: string; practiceKey?: string; target?: SaveTarget; libraryTitle?: string }>
  | Readonly<{ kind: 'missing' }>

const route = useRoute()
const router = useRouter()
const myCharts = useFeature('myCharts')
const query = (name: string): string => (typeof route.query[name] === 'string' ? (route.query[name] as string) : '')
const generation = ref(0)
/** the id our own first save put in the address: the editor stays as it is */
let adopted = ''

// without My charts the editor only opens library charts; with it, a bare /editor has nothing to open
// (not on the prerender, which has no query)
if (import.meta.client && !findChart(query('chart')) && (!myCharts || (!query('mine') && route.query.new === undefined)))
  await navigateTo('/', { replace: true })
if (import.meta.client && myCharts) migrateDraft(STARTER_CHART)

const source = computed((): Source => {
  void generation.value // a revert reads storage again
  const slug = query('chart')
  const library = findChart(slug)
  if (library) {
    if (!myCharts) return { kind: 'chart', text: library.text, practiceKey: slug }
    const version = versionOf(slug)
    const saved = version ? loadChart(version.id) : null
    const target: SaveTarget = { kind: 'library', slug, libraryText: library.text, ...(saved ? { id: saved.meta.id } : {}) }
    return { kind: 'chart', text: saved?.text ?? library.text, practiceKey: slug, target, libraryTitle: library.title }
  }
  const mine = query('mine')
  if (mine) {
    const saved = loadChart(mine)
    return saved ? { kind: 'chart', text: saved.text, practiceKey: `mine:${mine}`, target: { kind: 'mine', id: mine } } : { kind: 'missing' }
  }
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
  router.replace({ path: '/editor', query: { mine: id } })
}

function reload(): void {
  generation.value++
  editorKey.value = `${route.fullPath}#${generation.value}`
}

useHead({ title: 'Editor · Chord Scale Maker' })
</script>
