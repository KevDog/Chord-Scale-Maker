<template>
  <div class="flex flex-col gap-1">
    <select
      v-if="!picking"
      :value="selectValue"
      :aria-label="`Scale for ${chord || 'this row'}`"
      :class="[field, needsScale && 'border-amber-500 dark:border-amber-500']"
      @change="onSelect(($event.target as HTMLSelectElement).value)"
    >
      <option v-if="choices.defaultScale" value="">Default · {{ choices.defaultScale }}</option>
      <option v-else value="" disabled>Choose a scale…</option>
      <option v-for="o in choices.alternates" :key="o.scale" :value="o.scale">{{ o.scale }}{{ o.note ? ` (${o.note})` : '' }}</option>
      <option v-if="custom" :value="scale">{{ scale }}</option>
      <option value="__other">Other…</option>
    </select>
    <div v-else class="flex gap-1" @keydown.esc="closePicker">
      <select ref="rootSelect" v-model="pickRoot" aria-label="Scale root" :class="field">
        <option v-for="r in PICKER_ROOTS" :key="r" :value="r">{{ r }}</option>
      </select>
      <select v-model="pickName" aria-label="Scale name" :class="[field, 'min-w-0 flex-1']">
        <option v-for="n in PICKER_SCALES" :key="n" :value="n">{{ n }}</option>
      </select>
      <button type="button" aria-label="Set scale" class="rounded bg-accent px-2 text-sm text-white dark:text-zinc-950" @click="apply">Set</button>
      <button type="button" class="px-1 text-sm text-zinc-500" aria-label="Cancel" @click="closePicker">✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { enharmonics, parseChord, rootName } from '~~/engine'

const props = defineProps<{ chord: string; scale: string; field: string }>()
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
const rootSelect = useTemplateRef<HTMLSelectElement>('rootSelect')

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

async function openPicker(): Promise<void> {
  pickRoot.value = pickerRoot(props.chord)
  picking.value = true
  await nextTick()
  rootSelect.value?.focus()
}

function closePicker(): void {
  picking.value = false
}

function onSelect(value: string): void {
  if (value === '__other') openPicker()
  else emit('update', value)
}

function apply(): void {
  emit('update', `${pickRoot.value} ${pickName.value}`)
  closePicker()
}
</script>
