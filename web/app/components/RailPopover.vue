<template>
  <!-- inline: stacked under its toggle (in the Controls dialog); else a button whose panel opens over the sheet, so the rail keeps each group one control tall (#293) -->
  <div v-if="inline" class="flex flex-col items-start gap-2"><slot /></div>
  <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- Escape from the button or panel inside bubbles here -->
  <div v-else ref="root" class="relative" :class="summary && 'w-full'" @keydown.esc="close">
    <!-- summary: reads as a select (Catalyst's listbox button) naming what's set, its panel below -->
    <button
      v-if="summary"
      ref="button"
      v-interactive
      type="button"
      :aria-label="`${label}: ${summary}`"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :data-open="open ? '' : undefined"
      :class="LISTBOX_BUTTON"
      @click="open = !open"
    >
      <span :class="LISTBOX_SELECTED"><span class="block truncate">{{ summary }}</span></span>
      <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <ChevronDownIcon class="size-5 text-zinc-500 sm:size-4 dark:text-zinc-400" aria-hidden="true" />
      </span>
    </button>
    <!-- else a chevron, its panel to the right -->
    <UiButton v-else ref="button" plain :aria-label="label" :aria-expanded="open" aria-haspopup="dialog" @click="open = !open">
      <EllipsisHorizontalIcon v-if="place !== 'side'" data-slot="icon" />
      <ChevronRightIcon v-else data-slot="icon" />
    </UiButton>
    <Transition name="ease-fade">
      <div
        v-if="open"
        role="dialog"
        :aria-label="label"
        :class="[
          'absolute z-20 flex w-max flex-col items-start gap-2 rounded-paper bg-raised p-3 shadow-raised print:hidden',
          summary
            ? 'top-full left-0 mt-2 max-sm:right-0 max-sm:left-auto'
            : place === 'above'
              ? 'right-0 bottom-full mb-2'
              : place === 'below'
                ? 'top-full right-0 mt-2'
                : 'top-0 left-full ml-2 max-sm:top-full max-sm:left-0 max-sm:mt-2 max-sm:ml-0',
        ]"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ChevronDownIcon, ChevronRightIcon, EllipsisHorizontalIcon } from '@heroicons/vue/16/solid'
import { LISTBOX_BUTTON, LISTBOX_SELECTED } from '~/components/ui/listboxStyles'
import { FIELD } from '~/utils/field'
import { vInteractive } from '~/utils/interactive'

/**
 * a group's details, opened beside it: open stays until a click outside, Escape, or the button again. summary: the
 * button reads as a select showing what's set ("Piano · F3–E6"), named "label: summary", its panel below.
 */
/** place: a button's panel beside it (the rail), or above or below it (the click's bar: its ⋯ button) */
withDefaults(defineProps<{ label: string; inline?: boolean; summary?: string; place?: 'side' | 'above' | 'below' }>(), { summary: undefined, place: 'side' })
// the panel's controls name themselves: a UiField the popover sits in labels its button, not them
provide(FIELD, undefined)
const open = defineModel<boolean>('open', { required: true })
const root = ref<HTMLElement | null>(null)
const button = ref<HTMLElement | { $el: HTMLElement } | null>(null)

function close(): void {
  if (!open.value) return
  open.value = false
  const b = button.value
  ;(b instanceof HTMLElement ? b : b?.$el)?.focus()
}
function outside(e: PointerEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
watch(open, (o) => (o ? document.addEventListener('pointerdown', outside) : document.removeEventListener('pointerdown', outside)))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
