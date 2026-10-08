<template>
  <span ref="cell" class="relative block">
    <UiSelect
      :key="resetKey"
      :model-value="selectValue"
      :aria-label="`Scale for ${chord || 'this row'}`"
      :style="showFormula ? { '--formula-w': `${formulaWidth + 40}px` } : undefined"
      :class="['sm:py-1 sm:text-sm/5', showFormula && '[&>select]:pr-(--formula-w)', needsScale && 'border-amber-500! dark:border-amber-500!']"
      @update:model-value="onSelect"
    >
      <option v-if="choices.defaultScale" value="">Default · {{ choices.defaultScale }}</option>
      <option v-else value="" disabled>Choose a scale…</option>
      <option v-for="o in inside" :key="o.scale" :value="o.scale">{{ o.scale }}{{ o.note ? ` (${o.note})` : '' }}</option>
      <optgroup v-if="outside.length" label="Outside (tension to resolve)">
        <option v-for="o in outside" :key="o.scale" :value="o.scale">{{ o.scale }}{{ o.note ? ` (${o.note})` : '' }}</option>
      </optgroup>
      <option v-if="custom" :value="scale">{{ scale }}</option>
      <option value="__other">Other…</option>
    </UiSelect>
    <span v-if="showFormula" class="pointer-events-none absolute inset-y-0 right-8 flex items-center text-xs/5 text-zinc-500 tabular-nums dark:text-zinc-400" aria-hidden="true">{{ formula }}</span>
  </span>

  <UiDialog :open="picking" size="md" @close="closePicker" @closed="refocus">
    <UiDialogTitle>Choose a scale</UiDialogTitle>
    <UiDialogDescription>For {{ chord || 'this row' }}: any root and any of the {{ PICKER_SCALES.length }} scales.</UiDialogDescription>
    <UiDialogBody>
      <div class="grid grid-cols-[7rem_1fr] gap-4">
        <UiField>
          <UiLabel>Root</UiLabel>
          <UiSelect v-model="pickRoot" aria-label="Scale root">
            <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ noteText(r) }}</option>
          </UiSelect>
        </UiField>
        <UiField>
          <UiLabel>Scale</UiLabel>
          <UiSelect v-model="pickName" aria-label="Scale name">
            <option v-for="n in PICKER_SCALES" :key="n" :value="n">{{ n }}</option>
          </UiSelect>
        </UiField>
      </div>
    </UiDialogBody>
    <UiDialogActions>
      <UiButton plain @click="closePicker">Cancel</UiButton>
      <UiButton color="note" @click="apply">Set scale</UiButton>
    </UiDialogActions>
  </UiDialog>
</template>

<script setup lang="ts">
import { enharmonics, glyphs, noteText, parseChord, parseScale, rootName, SCALES } from '~~/engine'

/** a row's scale: the chord's default, its alternates, or "Other…" (any scale, in a dialog) */
const props = defineProps<{ chord: string; scale: string }>()
const emit = defineEmits<{ update: [scale: string] }>()

const choices = computed(() => scaleChoices(props.chord))
const inside = computed(() => choices.value.alternates.filter((o) => !o.outside))
const outside = computed(() => choices.value.alternates.filter((o) => o.outside))
/** a scale typed in the text that equals the default shows as the default */
const isDefault = computed(() => props.scale === choices.value.defaultScale)
const custom = computed(() => props.scale !== '' && !isDefault.value && !choices.value.alternates.some((o) => o.scale === props.scale))
const selectValue = computed(() => (isDefault.value ? '' : props.scale))
const needsScale = computed(() => props.scale === '' && !choices.value.defaultScale)
/** the shown scale's degree formula, "1, 2, ♭3, 4, 5, 6, ♭7"; null if there's no scale (or it can't be read) */
const formula = computed((): string | null => {
  const shown = props.scale || choices.value.defaultScale
  if (!shown) return null
  try {
    return glyphs(SCALES[parseScale(shown).key][0]).split(' ').join(', ')
  } catch {
    return null
  }
})
/** the selected option's text, as the select shows it */
const label = computed((): string => {
  if (isDefault.value || props.scale === '') return choices.value.defaultScale ? `Default · ${choices.value.defaultScale}` : 'Choose a scale…'
  const alt = choices.value.alternates.find((o) => o.scale === props.scale)
  return alt?.note ? `${alt.scale} (${alt.note})` : props.scale
})
/** the cell's width, so the formula shows only where it fits beside the label (wide cells: Text hidden, bigger screens) */
const width = ref(0)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !cell.value) return
  observer = new ResizeObserver(([entry]) => {
    width.value = entry?.contentRect.width ?? 0
  })
  observer.observe(cell.value)
})
onBeforeUnmount(() => observer?.disconnect())
/** the select's font, for measuring; the formula is the same family at 12px */
const font = ref('14px sans-serif')
onMounted(() => {
  const select = cell.value?.querySelector('select')
  if (select) font.value = getComputedStyle(select).font || font.value
})
const FORMULA_FONT_PX = 12
const SPACE = 72 // the select's left padding, the gap, and the arrow
const formulaWidth = computed(() => (formula.value ? textWidth(formula.value, font.value.replace(/\b\d+(\.\d+)?px\b/, `${FORMULA_FONT_PX}px`)) : 0))
/** room for the whole label and the formula (the select's padding reserves the formula's width plus the arrow) */
const showFormula = computed(() => formula.value !== null && width.value > 0 && width.value >= textWidth(label.value, font.value) + formulaWidth.value + SPACE)

const picking = ref(false)
const pickRoot = ref<string>('C')
const pickName = ref<string>(PICKER_SCALES[0] ?? 'Ionian')
/** re-creates the select after "Other…", which is never a value of its own */
const resetKey = ref(0)
const cell = ref<HTMLElement>()

/** the chord's root as one of the picker's spellings (Cb -> B, E# -> F), else C */
function pickerRoot(chord: string): string {
  try {
    const root = parseChord(chord).root
    const names = [root, ...enharmonics(root)].map(rootName)
    return names.find((n) => (PICKER_ROOTS as readonly string[]).includes(n)) ?? 'C'
  } catch {
    return 'C'
  }
}

function closePicker(): void {
  picking.value = false
}

/** the select was re-created, so Headless UI can't return focus to it; this runs after its own restore */
function refocus(): void {
  setTimeout(() => cell.value?.querySelector('select')?.focus())
}

function onSelect(value: string): void {
  if (value !== '__other') return emit('update', value)
  pickRoot.value = pickerRoot(props.chord)
  picking.value = true
  resetKey.value++
}

function apply(): void {
  emit('update', `${pickRoot.value} ${pickName.value}`)
  closePicker()
}
</script>
