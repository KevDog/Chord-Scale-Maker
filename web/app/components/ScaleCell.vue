<template>
  <span ref="cell" class="contents">
    <UiSelect
      :key="resetKey"
      :model-value="selectValue"
      :aria-label="`Scale for ${chord || 'this row'}`"
      :class="['sm:py-1 sm:text-sm/5', needsScale && 'border-amber-500! dark:border-amber-500!']"
      @update:model-value="onSelect"
    >
      <option v-if="choices.defaultScale" value="">Default · {{ choices.defaultScale }}</option>
      <option v-else value="" disabled>Choose a scale…</option>
      <option v-for="o in choices.alternates" :key="o.scale" :value="o.scale">{{ o.scale }}{{ o.note ? ` (${o.note})` : '' }}</option>
      <option v-if="custom" :value="scale">{{ scale }}</option>
      <option value="__other">Other…</option>
    </UiSelect>
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
      <UiButton color="teal" @click="apply">Set scale</UiButton>
    </UiDialogActions>
  </UiDialog>
</template>

<script setup lang="ts">
import { enharmonics, noteText, parseChord, rootName } from '~~/engine'

/** a row's scale: the chord's default, its alternates, or "Other…" (any scale, in a dialog) */
const props = defineProps<{ chord: string; scale: string }>()
const emit = defineEmits<{ update: [scale: string] }>()

const choices = computed(() => scaleChoices(props.chord))
/** a scale typed in the text that equals the default shows as the default */
const isDefault = computed(() => props.scale === choices.value.defaultScale)
const custom = computed(() => props.scale !== '' && !isDefault.value && !choices.value.alternates.some((o) => o.scale === props.scale))
const selectValue = computed(() => (isDefault.value ? '' : props.scale))
const needsScale = computed(() => props.scale === '' && !choices.value.defaultScale)

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
