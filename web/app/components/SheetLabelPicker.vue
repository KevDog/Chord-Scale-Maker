<template>
  <HPopover :class="['relative inline-block max-w-full', blank && 'print:hidden']">
    <HPopoverButton
      :class="[
        'hit-target block max-w-full cursor-pointer truncate rounded-sm text-left underline decoration-dotted underline-offset-[3px] hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500 dark:hover:bg-white/5 print:no-underline',
        guessed ? 'decoration-amber-500' : 'decoration-note-500/60 dark:decoration-note-300/60',
        blank && 'text-zinc-400 dark:text-zinc-500',
      ]"
      :aria-label="blank ? name : undefined"
      :title="guessed ? 'The rules could only guess here' : undefined"
      @click="place"
    >
      <span v-if="pinned && kind === 'scale'" data-pin class="mr-0.5 inline-flex align-baseline" title="Your scale: it plays at every level"><MapPinIcon class="size-3 text-note-600 dark:text-note-400" aria-hidden="true" /></span>
      <template v-if="blank">—</template>
      <slot v-else />
    </HPopoverButton>
    <HPopoverPanel
      role="dialog"
      :style="{ left: `${shift}px` }"
      :aria-label="name"
      class="absolute top-full left-0 z-20 mt-2 w-80 rounded-lg bg-white p-3 text-left text-sm/6 font-normal text-zinc-700 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10 print:hidden"
    >
      <ChordChoices
        :doc="doc"
        :line="line"
        :part="kind === 'numeral' ? 'function' : 'scale'"
        :fallback-note="guessed ? 'The rules could only guess here; stating the function settles it.' : undefined"
        @update:doc="emit('update:doc', $event)"
        @said="emit('said', $event)"
      />
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { MapPinIcon } from '@heroicons/vue/16/solid'
import type { ChartDoc } from '@chord-scale-maker/engine'
import ChordChoices from './ChordChoices.vue'
import { panelShift } from '~/utils/notePlacement'

/**
 * A numeral or scale under a chord while the sheet is the editor (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md
 * §1.3): the label is the picker. The numeral opens the chord's function list (with why the analysis chose), the
 * scale its scale list; a guessed function is marked in amber; a pinned scale shows its pin. `line` is the chart line
 * the chord is written on (a repeat's chord points at the row it repeats). A chord with no label (no analysis, or a
 * row the sheet can't read) gets a blank one, a dash, so there is still something to click.
 */
const props = defineProps<{ doc: ChartDoc; line: number; kind: 'numeral' | 'scale'; chord: string; fallback: boolean; pinned: boolean; blank?: boolean }>()
const emit = defineEmits<{ 'update:doc': [doc: ChartDoc]; said: [text: string] }>()

const guessed = computed(() => props.fallback && props.kind === 'numeral')
const name = computed(() => `${props.kind === 'numeral' ? 'Function' : 'Scale'}: ${props.chord}`)
const PANEL_WIDTH = 320 // w-80
const shift = ref(0)
/** keep the panel inside the window, as ChangesNote does (it opens at the label's left edge) */
function place(e: MouseEvent): void {
  const el = e.currentTarget as HTMLElement | null
  if (el) shift.value = panelShift(el.getBoundingClientRect().left, PANEL_WIDTH, document.documentElement.clientWidth)
}
</script>
