<template>
  <span data-slot="control" :class="WRAPPER">
    <textarea
      v-bind="$attrs"
      :id="($attrs.id as string | undefined) ?? field?.controlId"
      v-model="model"
      v-interactive:any-focus
      :disabled="isDisabled"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-describedby="describedBy(field)"
      :data-invalid="dataFlag(invalid)"
      :data-disabled="dataFlag(isDisabled)"
      :class="[CONTROL, resizable ? 'resize-y' : 'resize-none']"
    />
  </span>
</template>

<script setup lang="ts">
import { describedBy, FIELD } from '~/utils/field'
import { dataFlag, vInteractive } from '~/utils/interactive'

/** Catalyst Textarea; attributes go to the <textarea> */
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ resizable?: boolean; invalid?: boolean; disabled?: boolean }>(), { resizable: true })
const model = defineModel<string>({ default: '' })
const field = inject(FIELD, undefined)
const isDisabled = computed(() => props.disabled || !!field?.disabled.value)

const WRAPPER = [
  // Basic layout
  'relative block w-full',
  // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
  'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
  // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
  'dark:before:hidden',
  // Focus ring
  'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
  // Disabled state
  'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
]
const CONTROL = [
  // Basic layout
  'relative block h-full w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
  // Typography
  'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white',
  // Border
  'border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20',
  // Background color
  'bg-transparent dark:bg-white/5',
  // Hide default focus styles
  'focus:outline-hidden',
  // Invalid state
  'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600',
  // Disabled state
  'disabled:border-zinc-950/20 dark:disabled:border-white/15 dark:disabled:bg-white/2.5 dark:data-hover:disabled:border-white/15',
]
</script>
