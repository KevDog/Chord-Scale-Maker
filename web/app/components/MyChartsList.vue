<template>
  <section v-if="charts.length" aria-labelledby="my-charts-heading" class="mt-8">
    <div class="flex flex-wrap items-baseline gap-x-3">
      <UiSubheading id="my-charts-heading" :level="2">My charts</UiSubheading>
      <UiText class="text-sm/6!">Saved in this browser only.</UiText>
    </div>
    <UiTable class="mt-3 [--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
      <UiTableHead>
        <UiTableRow>
          <UiTableHeader>Title</UiTableHeader>
          <UiTableHeader>Changed</UiTableHeader>
          <UiTableHeader><span class="sr-only">Actions</span></UiTableHeader>
        </UiTableRow>
      </UiTableHead>
      <UiTableBody>
        <UiTableRow v-for="c in shown" :key="c.id">
          <UiTableCell class="font-medium">
            <UiLink :href="openHref(c)" class="text-note-800 hover:underline dark:text-note-300">{{ c.title }}</UiLink>
            <UiBadge :color="KIND_COLOR[c.kind]" class="ml-2">{{ kindLabel(c) }}</UiBadge>
          </UiTableCell>
          <UiTableCell class="text-zinc-500 dark:text-zinc-400">{{ changed(c.updatedAt) }}</UiTableCell>
          <UiTableCell class="text-right">
            <UiButton plain :aria-label="`Download ${c.title}`" title="Download as a .txt file" @click="download(c)"><ArrowDownTrayIcon data-slot="icon" /></UiButton>
            <UiButton plain :aria-label="`Delete ${c.title}`" title="Delete" @click="toDelete = c"><TrashIcon data-slot="icon" /></UiButton>
          </UiTableCell>
        </UiTableRow>
      </UiTableBody>
    </UiTable>
    <UiText v-if="!shown.length" class="mt-3">None of your charts match "{{ query }}".</UiText>

    <UiDialog :open="toDelete !== null" size="md" @close="toDelete = null">
      <UiDialogTitle>Delete {{ toDelete?.title }}?</UiDialogTitle>
      <UiDialogDescription>{{ deleteText }}</UiDialogDescription>
      <UiDialogActions>
        <UiButton plain @click="toDelete = null">Cancel</UiButton>
        <UiButton color="red" @click="confirmDelete">Delete</UiButton>
      </UiDialogActions>
    </UiDialog>
  </section>
</template>

<script setup lang="ts">
import { ArrowDownTrayIcon, TrashIcon } from '@heroicons/vue/16/solid'
import type { BadgeColor } from '~/utils/catalyst/badge'
import type { SavedMeta } from '~/utils/myCharts'

/** My charts on the library page: your edited versions, copies and new charts, newest first (client-only) */
const props = defineProps<{ query: string }>()

const KIND_COLOR: Readonly<Record<SavedMeta['kind'], BadgeColor>> = { edited: 'amber', copy: 'zinc', new: 'note' }
const charts = ref<SavedMeta[]>([])
const toDelete = ref<SavedMeta | null>(null)

const refresh = (): void => {
  charts.value = listCharts()
}
const onStorage = (e: StorageEvent): void => {
  if (e.key === null || e.key.startsWith('csm-chart')) refresh() // another tab saved or deleted one
}
onMounted(() => {
  migrateDraft(STARTER_CHART)
  refresh()
  window.addEventListener('storage', onStorage)
})
onBeforeUnmount(() => window.removeEventListener('storage', onStorage))

const shown = computed(() => charts.value.filter((c) => searchLibrary([{ slug: c.id, title: c.title, subtitle: '', composer: '', text: '' }], props.query).length))

const openHref = (c: SavedMeta): string => (c.kind === 'edited' && c.basedOn ? `/editor?chart=${c.basedOn}` : `/editor?mine=${c.id}`)
const kindLabel = (c: SavedMeta): string => (c.kind === 'edited' ? 'Edited' : c.kind === 'copy' ? 'Copy' : 'Mine')
const changed = (at: number): string => {
  const d = new Date(at)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric', month: 'short', day: 'numeric' })
}
const deleteText = computed(() =>
  toDelete.value?.kind === 'edited'
    ? 'Your edits are removed from this browser, and the library version stays. This can’t be undone.'
    : 'It’s removed from this browser. This can’t be undone; download it first to keep a copy.',
)

function download(c: SavedMeta): void {
  const saved = loadChart(c.id)
  if (saved) downloadText(filenameFor(c.title), saved.text)
}

function confirmDelete(): void {
  if (toDelete.value) deleteChart(toDelete.value.id)
  toDelete.value = null
  refresh()
}
</script>
