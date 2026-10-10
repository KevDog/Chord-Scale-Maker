<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2">
      <UiField v-for="key in META_KEYS" :key="key">
        <UiLabel class="capitalize">{{ key }}</UiLabel>
        <template v-if="key === 'key'">
          <UiSelect :model-value="meta.key" :invalid="!isValidKey(meta.key)" aria-label="Key" @update:model-value="(v) => emitDoc(setMeta(doc, 'key', String(v)))">
            <option value="" disabled>Pick a key</option>
            <option v-for="k in KEY_OPTIONS" :key="k" :value="k">{{ keyLabel(k) }}</option>
          </UiSelect>
          <UiErrorMessage v-if="!isValidKey(meta.key)">Pick the chart's key</UiErrorMessage>
        </template>
        <GridCell v-else meta :value="meta[key]" :max-length="LIMITS.maxMeta" @update="(v) => emitDoc(setMeta(doc, key, v))" />
      </UiField>
    </div>
    <div v-if="functionsOn" class="flex justify-end">
      <UiButton plain :aria-pressed="notes" @click="notes = !notes">{{ notes ? 'Hide notes' : 'Show notes' }}</UiButton>
    </div>
    <UiTable dense bleed class="[--gutter:--spacing(1)]">
      <UiTableHead>
        <UiTableRow>
          <UiTableHeader class="w-20">Section</UiTableHeader>
          <UiTableHeader class="w-16">Bar</UiTableHeader>
          <UiTableHeader class="w-32">Chord</UiTableHeader>
          <UiTableHeader>Scale</UiTableHeader>
          <UiTableHeader v-if="functionsOn" class="w-56">Function</UiTableHeader>
          <UiTableHeader v-if="functionsOn && notes">Notes</UiTableHeader>
          <UiTableHeader class="w-20"><span class="sr-only">Row actions</span></UiTableHeader>
        </UiTableRow>
      </UiTableHead>
      <UiTableBody>
        <template v-for="(line, i) in doc.lines" :key="i">
          <UiTableRow v-if="line.kind === 'row'">
            <UiTableCell v-for="f in TEXT_FIELDS" :key="f" class="px-1! py-1!">
              <GridCell dense :value="line[f]" :label="`${f} for row ${rowNumber[i]}`" @update="(v) => emitDoc(f === 'chord' ? setRowChord(doc, i, v) : setRowField(doc, i, f, v))" />
            </UiTableCell>
            <UiTableCell class="min-w-56 px-1! py-1!">
              <ScaleCell :chord="line.chord" :scale="line.scale" @update="(s) => emitDoc(setRowField(doc, i, 'scale', s))" />
            </UiTableCell>
            <UiTableCell v-if="functionsOn" class="min-w-48 px-1! py-1!">
              <FunctionCell
                :choices="choicesByLine.get(i) ?? []"
                :value="line.function ?? ''"
                :problem="notesByLine.get(i)?.problem ?? null"
                :label="`function for row ${rowNumber[i]}`"
                @update="(v) => emitDoc(setRowField(doc, i, 'function', v))"
              />
            </UiTableCell>
            <UiTableCell v-if="functionsOn && notes" class="px-1! py-1! text-sm/5 whitespace-normal text-zinc-600 dark:text-zinc-400">{{ notesByLine.get(i)?.note }}</UiTableCell>
            <UiTableCell class="px-1! py-1! text-right">
              <UiButton v-if="functionsOn" plain :aria-label="`Key change at row ${rowNumber[i]}`" title="Start a key change here" @click="emitDoc(insertKeyChange(doc, i))"><KeyIcon data-slot="icon" /></UiButton>
              <UiButton plain :aria-label="`Add row after row ${rowNumber[i]}`" @click="emitDoc(insertRowAfter(doc, i))"><PlusIcon data-slot="icon" /></UiButton>
              <UiButton plain :aria-label="`Delete row ${rowNumber[i]}`" @click="emitDoc(removeLine(doc, i))"><TrashIcon data-slot="icon" /></UiButton>
            </UiTableCell>
          </UiTableRow>
          <UiTableRow v-else-if="line.kind === 'copy'">
            <UiTableCell :colspan="columns - 1" class="text-zinc-500 dark:text-zinc-400">
              <UiBadge color="sky" class="mr-2">@copy</UiBadge>repeat section <UiStrong>{{ line.src }}</UiStrong> as <UiStrong>{{ line.dst }}</UiStrong>, bars {{ line.offset >= 0 ? '+' : '' }}{{ line.offset }}
              <span class="ml-1">(edit in text)</span>
            </UiTableCell>
            <UiTableCell class="px-1! py-1! text-right">
              <UiButton plain :aria-label="`Delete line ${i + 1}`" @click="emitDoc(removeLine(doc, i))"><TrashIcon data-slot="icon" /></UiButton>
            </UiTableCell>
          </UiTableRow>
          <UiTableRow v-else-if="line.kind === 'key'">
            <UiTableCell :colspan="columns - 1" class="text-zinc-500 dark:text-zinc-400">
              <div class="flex flex-wrap items-center gap-2">
                <UiBadge color="sky">@key</UiBadge>
                <span>from <UiStrong>{{ line.section }} {{ line.bar }}</UiStrong> in</span>
                <template v-if="!functionsOn"><UiStrong>{{ keyLabel(line.key) }}</UiStrong><span>(edit in text)</span></template>
                <UiSelect v-else :model-value="line.key" :aria-label="`Key from ${line.section} ${line.bar}`" class="w-40 sm:py-1 sm:text-sm/5" @update:model-value="(v) => emitDoc(setKeyLine(doc, i, String(v)))">
                  <option v-for="k in KEY_OPTIONS" :key="k" :value="k">{{ keyLabel(k) }}</option>
                  <option v-if="!(KEY_OPTIONS as readonly string[]).includes(line.key)" :value="line.key">{{ line.key }}</option>
                </UiSelect>
              </div>
              <UiErrorMessage v-if="notesByLine.get(i)?.problem">{{ notesByLine.get(i)?.problem }}</UiErrorMessage>
            </UiTableCell>
            <UiTableCell class="px-1! py-1! text-right">
              <UiButton plain :aria-label="`Delete line ${i + 1}`" @click="emitDoc(removeLine(doc, i))"><TrashIcon data-slot="icon" /></UiButton>
            </UiTableCell>
          </UiTableRow>
          <UiTableRow v-else-if="line.kind === 'invalid'">
            <UiTableCell :colspan="columns" class="text-red-700 dark:text-red-400">
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
import { KeyIcon, PlusIcon, TrashIcon } from '@heroicons/vue/16/solid'
import { type ChartDoc, chartMeta, type FunctionChoice, functionChoices, insertKeyChange, insertRowAfter, isValidKey, keyLabel, LIMITS, type MetaKey, removeLine, type RowField, type RowNote, rowNotes, setKeyLine, setMeta, setRowChord, setRowField } from '~~/engine'

const props = defineProps<{ doc: ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc] }>()

const META_KEYS: readonly Extract<MetaKey, 'title' | 'subtitle' | 'key'>[] = ['title', 'subtitle', 'key'] // the heading; the rest stays in the text
const KEY_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'] as const
const TEXT_FIELDS: readonly Exclude<RowField, 'scale' | 'function'>[] = ['section', 'bar', 'chord']

const meta = computed(() => chartMeta(props.doc))
/** line index -> 1-based number among chord rows, for labels */
const rowNumber = computed(() => {
  let n = 0
  return props.doc.lines.map((l) => (l.kind === 'row' ? ++n : 0))
})
const functionsOn = useFeature('functions')
const { notes } = usePreferences()
/** the live analysis beside each row (engine/notes.ts): its note, its problem, its key area; and its function options */
const notesByLine = computed<ReadonlyMap<number, RowNote>>(() => (functionsOn ? rowNotes(props.doc) : new Map()))
const choicesByLine = computed<ReadonlyMap<number, readonly FunctionChoice[]>>(() => (functionsOn ? functionChoices(props.doc) : new Map()))
/** section, bar, chord, scale, [function], [notes], actions */
const columns = computed(() => 5 + (functionsOn ? 1 : 0) + (functionsOn && notes.value ? 1 : 0))
const emitDoc = (doc: ChartDoc): void => emit('update:doc', doc)
</script>
