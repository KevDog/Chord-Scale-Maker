<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2">
      <UiField v-for="key in META_KEYS" :key="key">
        <UiLabel class="capitalize">{{ key }}</UiLabel>
        <GridCell :value="meta[key]" :max-length="LIMITS.maxMeta" @update="(v) => emitDoc(setMeta(doc, key, v))" />
      </UiField>
    </div>
    <!-- the editor's chart actions (Transpose, Print) sit under the title fields -->
    <slot name="actions" />

    <UiTable dense bleed class="[--gutter:--spacing(1)]">
      <UiTableHead>
        <UiTableRow>
          <UiTableHeader class="w-20">Section</UiTableHeader>
          <UiTableHeader class="w-16">Bar</UiTableHeader>
          <UiTableHeader class="w-32">Chord</UiTableHeader>
          <UiTableHeader>Scale</UiTableHeader>
          <UiTableHeader class="w-20"><span class="sr-only">Row actions</span></UiTableHeader>
        </UiTableRow>
      </UiTableHead>
      <UiTableBody>
        <template v-for="(line, i) in doc.lines" :key="i">
          <UiTableRow v-if="line.kind === 'row'">
            <UiTableCell v-for="f in TEXT_FIELDS" :key="f" class="px-1! py-1!">
              <GridCell dense :value="line[f]" :label="`${f} for row ${rowNumber[i]}`" @update="(v) => emitDoc(setRowField(doc, i, f, v))" />
            </UiTableCell>
            <UiTableCell class="min-w-56 px-1! py-1!">
              <ScaleCell :chord="line.chord" :scale="line.scale" @update="(s) => emitDoc(setRowField(doc, i, 'scale', s))" />
            </UiTableCell>
            <UiTableCell class="px-1! py-1! text-right">
              <UiButton plain :aria-label="`Add row after row ${rowNumber[i]}`" @click="emitDoc(insertRowAfter(doc, i))"><PlusIcon data-slot="icon" /></UiButton>
              <UiButton plain :aria-label="`Delete row ${rowNumber[i]}`" @click="emitDoc(removeLine(doc, i))"><TrashIcon data-slot="icon" /></UiButton>
            </UiTableCell>
          </UiTableRow>
          <UiTableRow v-else-if="line.kind === 'copy'">
            <UiTableCell colspan="4" class="text-zinc-500 dark:text-zinc-400">
              <UiBadge color="sky" class="mr-2">@copy</UiBadge>repeat section <UiStrong>{{ line.src }}</UiStrong> as <UiStrong>{{ line.dst }}</UiStrong>, bars {{ line.offset >= 0 ? '+' : '' }}{{ line.offset }}
              <span class="ml-1">(edit in text)</span>
            </UiTableCell>
            <UiTableCell class="px-1! py-1! text-right">
              <UiButton plain :aria-label="`Delete line ${i + 1}`" @click="emitDoc(removeLine(doc, i))"><TrashIcon data-slot="icon" /></UiButton>
            </UiTableCell>
          </UiTableRow>
          <UiTableRow v-else-if="line.kind === 'invalid'">
            <UiTableCell colspan="5" class="text-red-700 dark:text-red-400">
              <UiBadge color="red" class="mr-2">line {{ i + 1 }}</UiBadge><UiCode>{{ line.text }}</UiCode>
              <span class="ml-2">fix in the text editor</span>
            </UiTableCell>
          </UiTableRow>
        </template>
      </UiTableBody>
    </UiTable>

    <UiButton outline @click="emitDoc(insertRowAfter(doc, doc.lines.length - 1))"><PlusIcon data-slot="icon" />Add row</UiButton>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon, TrashIcon } from '@heroicons/vue/16/solid'
import { type ChartDoc, type MetaKey, type RowField, chartMeta, insertRowAfter, LIMITS, removeLine, setMeta, setRowField } from '~~/engine'

const props = defineProps<{ doc: ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc] }>()

const META_KEYS: readonly MetaKey[] = ['title', 'subtitle']
const TEXT_FIELDS: readonly Exclude<RowField, 'scale'>[] = ['section', 'bar', 'chord']

const meta = computed(() => chartMeta(props.doc))
/** line index -> 1-based number among chord rows, for labels */
const rowNumber = computed(() => {
  let n = 0
  return props.doc.lines.map((l) => (l.kind === 'row' ? ++n : 0))
})
const emitDoc = (doc: ChartDoc): void => emit('update:doc', doc)
</script>
