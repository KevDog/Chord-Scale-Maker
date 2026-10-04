<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-2">
      <label v-for="key in META_KEYS" :key="key" class="text-sm">
        <span class="mb-1 block capitalize text-slate-500 dark:text-slate-400">{{ key }}</span>
        <input
          :value="meta[key]"
          :class="[field, 'w-full', errors[`meta:${key}`] && invalid]"
          :title="errors[`meta:${key}`]"
          @input="onMeta(key, ($event.target as HTMLInputElement).value)"
        >
      </label>
    </div>

    <table class="w-full border-separate border-spacing-y-1 text-sm">
      <thead class="text-left text-slate-500 dark:text-slate-400">
        <tr>
          <th class="w-16 font-normal">Section</th>
          <th class="w-14 font-normal">Bar</th>
          <th class="w-28 font-normal">Chord</th>
          <th class="font-normal">Scale</th>
          <th class="w-14"><span class="sr-only">Row actions</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="(line, i) in doc.lines" :key="i">
          <tr v-if="line.kind === 'row'">
            <td v-for="f in TEXT_FIELDS" :key="f" class="pr-1">
              <input
                :value="line[f]"
                :aria-label="`${f} for row ${rowNumber[i]}`"
                :class="[field, 'w-full', errors[`${i}:${f}`] && invalid]"
                :title="errors[`${i}:${f}`]"
                @input="onCell(i, f, ($event.target as HTMLInputElement).value)"
              >
            </td>
            <td class="pr-1">
              <ScaleCell :chord="line.chord" :scale="line.scale" :field="`${field} w-full`" @update="(s) => emitDoc(setRowField(doc, i, 'scale', s))" />
            </td>
            <td class="whitespace-nowrap text-right">
              <button type="button" :class="iconButton" :aria-label="`Add row after row ${rowNumber[i]}`" @click="emitDoc(insertRowAfter(doc, i))">+</button>
              <button type="button" :class="iconButton" :aria-label="`Delete row ${rowNumber[i]}`" @click="emitDoc(removeLine(doc, i))">−</button>
            </td>
          </tr>
          <tr v-else-if="line.kind === 'copy'" class="text-slate-500 dark:text-slate-400">
            <td colspan="4" class="py-1 pl-1 font-mono text-xs">
              repeat section <b>{{ line.src }}</b> as <b>{{ line.dst }}</b>, bars {{ line.offset >= 0 ? '+' : '' }}{{ line.offset }}
              <span class="ml-1 text-slate-400">(edit in text)</span>
            </td>
            <td class="text-right">
              <button type="button" :class="iconButton" :aria-label="`Delete line ${i + 1}`" @click="emitDoc(removeLine(doc, i))">−</button>
            </td>
          </tr>
          <tr v-else-if="line.kind === 'invalid'">
            <td colspan="5" class="rounded bg-rose-50 px-2 py-1 font-mono text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              line {{ i + 1 }}: {{ line.text }} <span class="font-sans">— fix in the text editor</span>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <button type="button" class="rounded-md border border-slate-300 px-3 py-1 text-sm hover:border-accent dark:border-slate-700" @click="emitDoc(insertRowAfter(doc, doc.lines.length - 1))">
      Add row
    </button>
  </div>
</template>

<script setup lang="ts">
import { type ChartDoc, type MetaKey, type RowField, cellError, chartMeta, insertRowAfter, LIMITS, removeLine, setMeta, setRowField } from '~~/engine'

const props = defineProps<{ doc: ChartDoc }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc] }>()

const META_KEYS: readonly MetaKey[] = ['title', 'subtitle']
const TEXT_FIELDS: readonly Exclude<RowField, 'scale'>[] = ['section', 'bar', 'chord']
const field = 'rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900'
const invalid = 'border-rose-500 dark:border-rose-500'
const iconButton = 'h-7 w-7 rounded text-slate-500 hover:bg-slate-100 hover:text-accent dark:hover:bg-slate-800'

const meta = computed(() => chartMeta(props.doc))
/** line index -> 1-based number among chord rows, for labels */
const rowNumber = computed(() => {
  let n = 0
  return props.doc.lines.map((l) => (l.kind === 'row' ? ++n : 0))
})
/** cell key -> why the typed value was not applied */
const errors = ref<Readonly<Record<string, string>>>({})

const emitDoc = (doc: ChartDoc): void => emit('update:doc', doc)

/** only values that survive serialize -> parse are applied; others stay in the input, flagged */
function guarded(key: string, value: string, maxLength: number, apply: () => ChartDoc): void {
  const error = cellError(value, maxLength)
  if (error) {
    errors.value = { ...errors.value, [key]: error }
    return
  }
  const { [key]: _cleared, ...rest } = errors.value
  errors.value = rest
  emitDoc(apply())
}

const onCell = (i: number, f: RowField, value: string): void =>
  guarded(`${i}:${f}`, value, LIMITS.maxCell, () => setRowField(props.doc, i, f, value))
const onMeta = (key: MetaKey, value: string): void =>
  guarded(`meta:${key}`, value, LIMITS.maxMeta, () => setMeta(props.doc, key, value))
</script>
