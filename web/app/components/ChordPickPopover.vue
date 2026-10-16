<template>
  <!-- a chord's pick (#303): a label or caption that opens its choices, the sheet's first; a pick sets the chord's bars -->
  <HPopover class="relative inline-block max-w-full">
    <HPopoverButton
      :aria-label="label"
      :class="['hit-target block cursor-pointer rounded-sm text-left underline underline-offset-[3px]', picked ? 'decoration-solid decoration-note-600 dark:decoration-note-300' : 'decoration-dotted decoration-note-500/60 dark:decoration-note-300/60', triggerClass]"
      class="hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500 dark:hover:bg-white/5 print:no-underline"
      @click="place"
    >{{ text }}</HPopoverButton>
    <HPopoverPanel v-slot="{ close }" role="dialog" :style="{ left: `${shift}px`, ...(pageZoom !== 1 ? { zoom: 1 / pageZoom } : {}) }" :aria-labelledby="headerId" class="absolute top-full z-20 mt-2 w-72 rounded-paper bg-raised p-1.5 text-left text-sm shadow-raised max-sm:w-[calc(100vw-2rem)] print:hidden">
      <p :id="headerId" class="px-2 pt-1 pb-2 text-xs/4 font-medium text-zinc-500 dark:text-zinc-400">{{ header }}</p>
      <ul class="border-y border-zinc-950/5 py-1 dark:border-white/10">
        <li><button type="button" data-sheet-choice :aria-current="picked ? undefined : 'true'" :class="rowClass(!picked)" @click="clear(close)">Sheet’s choice ({{ sheetChoice }})</button></li>
        <li v-for="r in rows" :key="r.id"><button type="button" data-choice :aria-current="picked && r.current ? 'true' : undefined" :class="rowClass(picked && r.current)" @click="choose(r.id, close)">{{ r.label }}</button></li>
      </ul>
      <p class="px-2 pt-2 pb-1 text-xs/4 text-zinc-600 dark:text-zinc-300">{{ footer }}</p>
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { panelShift } from '~/utils/notePlacement'
import { PAGE_ZOOM } from '~/utils/sheetPaged'

/** current: the row the chord plays; marked only under a pick (with none, the sheet's choice is the one current) */
export type ChoiceRow = Readonly<{ id: string; label: string; current: boolean }>
const props = defineProps<{ text: string; triggerLabel: string; header: string; footer: string; sheetChoice: string; picked: boolean; rows: readonly ChoiceRow[]; triggerClass?: string }>()
const emit = defineEmits<{ choose: [id: string]; clear: [] }>()
/** triggerLabel: what the trigger shows, in words ('Pentatonic: D minor, …'); a pick and the action follow */
const label = computed(() => `${props.triggerLabel}${props.picked ? ', your pick' : ''}. Show the choices`)
const headerId = useId()
const shift = ref(0)
/** in focus mode's zoomed page, the panel undoes the zoom, to read at full size */
const pageZoomRef = inject(PAGE_ZOOM, ref(1))
const pageZoom = computed(() => pageZoomRef.value)
/** on a click that opens the panel: measure it, then move it so it stays on the screen (it opens at its trigger's left edge) */
async function place(e: MouseEvent): Promise<void> {
  const anchor = (e.currentTarget as HTMLElement | null)?.parentElement // read before the await: currentTarget is cleared after dispatch
  shift.value = 0
  await new Promise((r) => requestAnimationFrame(r)) // the panel renders a tick or two after the click
  const panel = anchor?.querySelector<HTMLElement>('[role=dialog]')
  if (panel && anchor) shift.value = panelShift(anchor.getBoundingClientRect().left, panel.offsetWidth, document.documentElement.clientWidth)
}
const rowClass = (on: boolean): (string | false)[] => [
  'rounded-control w-full px-2 py-0.5 text-left text-zinc-900 hover:bg-note-50 dark:text-white dark:hover:bg-white/5',
  on && 'bg-note-100 text-note-800 dark:bg-note-300/15 dark:text-note-200',
]
function choose(id: string, close: () => void): void {
  emit('choose', id)
  close()
}
function clear(close: () => void): void {
  emit('clear')
  close()
}
</script>
