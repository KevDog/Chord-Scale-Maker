<template>
  <button
    v-interactive
    type="button"
    :aria-pressed="expands ? undefined : model"
    :aria-expanded="expands ? model : undefined"
    :disabled="disabled"
    :data-disabled="dataFlag(disabled)"
    :class="[buttonStyles.base, model ? ON : OFF, 'cursor-default']"
    @click="model = !model"
  >
    <UiTouchTarget><slot /></UiTouchTarget>
  </button>
</template>

<script setup lang="ts">
import { buttonStyles } from '~/utils/catalyst/button'
import { dataFlag, vInteractive } from '~/utils/interactive'

/** an on/off control (Numerals, Scales, Intervals, Edit): outline when off, the accent tint when on (.interface-design/system.md) */
const model = defineModel<boolean>({ required: true })
/** expands: it shows and hides a panel (Edit), so it reads as expanded, not pressed */
defineProps<{ disabled?: boolean; expands?: boolean }>()

const OFF = buttonStyles.outline
// the one accent's tint, its edge 3:1 or more on white and the stand (WCAG 1.4.11): note-800 on note-100 8.1:1 (7.0 hovered); dark, note-200 on note-300/15 over zinc-950 9.4:1 (8.3 hovered)
const ON = [
  'border-note-500 bg-note-100 text-note-800 data-hover:bg-note-200/70 data-active:bg-note-200/70 [--btn-icon:var(--color-note-600)]',
  'dark:border-note-300 dark:bg-note-300/15 dark:text-note-200 dark:data-hover:bg-note-300/20 dark:data-active:bg-note-300/20 dark:[--btn-icon:var(--color-note-300)]',
]
</script>
