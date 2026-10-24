<template>
  <HListbox v-bind="rootAttrs" v-model="model" :disabled="isDisabled" as="div" data-slot="control" class="relative">
    <HListboxButton
      :id="labelledBy ? buttonId : ariaLabel ? undefined : field?.controlId"
      v-slot="{ open }"
      v-interactive
      :aria-label="ariaLabel"
      :aria-labelledby="labelledBy ? `${labelledBy} ${buttonId}` : undefined"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-describedby="describedBy(field, attrs['aria-describedby'])"
      :data-invalid="dataFlag(invalid)"
      :data-disabled="dataFlag(isDisabled)"
      :class="BUTTON"
      as="button"
      @click="place"
      @keydown="place"
    >
      <!-- Headless UI React marks the button active while pressed or open -->
      <span :data-open="dataFlag(open)" class="contents" />
      <span :class="SELECTED">
        <span v-if="model !== undefined && model !== null" :class="SELECTED_CONTENT"><slot name="selected" :value="model" /></span>
        <span v-else class="block truncate text-zinc-500">{{ placeholder }}</span>
      </span>
      <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg class="size-5 stroke-zinc-500 group-data-disabled:stroke-zinc-600 sm:size-4 dark:stroke-zinc-400 forced-colors:stroke-[CanvasText]" viewBox="0 0 16 16" aria-hidden="true" fill="none">
          <path d="M5.75 10.75L8 13L10.25 10.75" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M10.25 5.25L8 3L5.75 5.25" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </HListboxButton>
    <transition leave-active-class="transition-opacity duration-100 ease-in" leave-to-class="opacity-0">
      <HListboxOptions as="div" :class="[OPTIONS, placement.above ? 'bottom-full mb-1' : 'top-full mt-1']" :style="{ maxHeight: `${placement.max}px` }">
        <slot />
      </HListboxOptions>
    </transition>
  </HListbox>
</template>

<script setup lang="ts" generic="T extends string | number | boolean | object | null">
import { Listbox as HListbox, ListboxButton as HListboxButton, ListboxOptions as HListboxOptions } from '@headlessui/vue'
import { describedBy, FIELD } from '~/utils/field'
import { LISTBOX_BUTTON, LISTBOX_SELECTED } from './listboxStyles'
import { dataFlag, vInteractive } from '~/utils/interactive'

/**
 * Catalyst Listbox on @headlessui/vue. Options are UiListboxOption children (optionally inside
 * UiListboxGroup); the button shows the #selected slot ({ value }). Inside a UiField the label
 * names the button, unless it has its own ariaLabel (a second control in the field). `labelledBy` (an element's id)
 * names it by that element and its value, as a field's label can't: aria-label hides the value (#425). Headless UI Vue has no anchor positioning: the menu opens below, or above when the window has more room there.
 */
const props = defineProps<{ placeholder?: string; ariaLabel?: string; labelledBy?: string; invalid?: boolean; disabled?: boolean }>()
/** the caller's attributes go on the wrapper, but its aria-describedby on the button, which it describes */
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const rootAttrs = computed(() => {
  const { 'aria-describedby': _described, ...rest } = attrs
  return rest
})
const model = defineModel<T>()
const field = inject(FIELD, undefined)
const buttonId = useId()
const isDisabled = computed(() => props.disabled || !!field?.disabled.value)

// where the menu opens, measured as it opens: below, unless the window has more room above (a menu low on the page, #509)
const MENU_MAX = 320
const placement = ref<Readonly<{ above: boolean; max: number }>>({ above: false, max: MENU_MAX })
function place(e: Event): void {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const below = window.innerHeight - r.bottom - 8
  const above = r.top - 8
  const up = below < 240 && above > below
  placement.value = { above: up, max: Math.max(120, Math.min(MENU_MAX, up ? above : below)) }
}

const BUTTON = LISTBOX_BUTTON
const SELECTED = LISTBOX_SELECTED
/** ListboxOption's shared classes, for the selected value shown in the button */
const SELECTED_CONTENT = [
  'flex min-w-0 items-center',
  '*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 sm:*:data-[slot=icon]:size-4',
  '*:data-[slot=icon]:text-zinc-500 dark:*:data-[slot=icon]:text-zinc-400',
]
const OPTIONS = [
  // Positioning (Headless UI Vue has no anchor): below or above the button (placement), at least its width
  'absolute z-20 min-w-full',
  // Base styles
  'isolate w-max max-w-[calc(100vw-3rem)] scroll-py-1 rounded-xl p-1 select-none',
  // Invisible border that is only visible in `forced-colors` mode for accessibility purposes
  'outline outline-transparent focus:outline-hidden',
  // Handle scrolling when menu won't fit in viewport
  'overflow-y-scroll overscroll-contain',
  // Popover background
  'bg-white/75 backdrop-blur-xl dark:bg-zinc-800/75',
  // Shadows
  'shadow-lg ring-1 ring-zinc-950/10 dark:ring-white/10 dark:ring-inset',
]
</script>
