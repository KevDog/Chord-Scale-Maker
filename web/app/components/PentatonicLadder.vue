<template>
  <!-- a pentatonic label on the Changes sheet (#255, #272); a click opens a key's ladder or a chord's ranking: pick another -->
  <HPopover class="relative inline-block max-w-full">
    <HPopoverButton
      :aria-label="ariaLabel"
      :class="['block cursor-pointer rounded-sm text-left underline underline-offset-[3px]', p.picked ? 'decoration-solid decoration-note-600' : 'decoration-dotted']"
      class="decoration-note-500/60 hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500 dark:decoration-note-300/60 dark:hover:bg-white/5 print:no-underline"
      @click="place"
    >{{ p.label }}</HPopoverButton>
    <HPopoverPanel v-slot="{ close }" role="dialog" :style="{ left: `${shift}px`, ...(pageZoom !== 1 ? { zoom: 1 / pageZoom } : {}) }" :aria-label="p.title" class="absolute top-full z-20 mt-2 w-64 rounded-paper bg-raised p-1.5 text-sm shadow-raised max-sm:w-[calc(100vw-2rem)] print:hidden">
      <p class="px-2 pt-1 pb-2 text-xs/4 font-medium text-zinc-500 dark:text-zinc-400">{{ p.title }}</p>
      <ul>
        <li v-for="r in rows" :key="r.key" class="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1 px-2 py-1">
          <span class="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{{ r.head }}</span>
          <button
            v-for="x in r.picks"
            :key="x.name"
            type="button"
            data-pent
            :aria-current="isCurrent(x) ? 'true' : undefined"
            :class="['rounded-control px-2 py-0.5 text-left font-display font-semibold text-zinc-900 hover:bg-note-50 dark:text-white dark:hover:bg-white/5', isCurrent(x) && 'bg-note-100 text-note-800 dark:bg-note-300/15 dark:text-note-200', r.picks.length === 1 && 'col-span-2']"
            @click="pick(x, close)"
          >{{ x.name }}</button>
        </li>
      </ul>
      <button v-if="p.picked" type="button" data-reset class="mt-1 w-full rounded-control px-2 py-1 text-left text-xs text-zinc-600 hover:bg-note-50 dark:text-zinc-300 dark:hover:bg-white/5" @click="reset(close)">Reset to {{ p.basis === 'chord' ? 'the sheet’s rank' : 'the path' }}</button>
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { panelShift } from '~/utils/notePlacement'
import { PAGE_ZOOM } from '~/utils/sheetPaged'
import { glyphs, rootName, pcOf, type ChangesPentatonic, type PentatonicRank, type PentatonicRung } from '@chord-scale-maker/engine'

/** a Changes label and its popover: a key area's ladder (one row a rung, ♭ then ♯) or a chord's ranking (one row a rank); a pick covers the label's run */
const props = defineProps<{ p: ChangesPentatonic }>()
const emit = defineEmits<{ pick: [written: number]; reset: [] }>()
const shift = ref(0)
/** in focus mode's zoomed page, the panel undoes the zoom, to read at full size */
const pageZoomRef = inject(PAGE_ZOOM, ref(1))
const pageZoom = computed(() => pageZoomRef.value)
/** on a click that opens the panel: measure it, then move it so it stays on the screen (it opens at its label's left edge) */
async function place(e: MouseEvent): Promise<void> {
  const anchor = (e.currentTarget as HTMLElement | null)?.parentElement // read before the await: currentTarget is cleared after dispatch
  shift.value = 0
  await new Promise((r) => requestAnimationFrame(r)) // the panel renders a tick or two after the click
  const panel = anchor?.querySelector<HTMLElement>('[role=dialog]')
  if (panel && anchor) shift.value = panelShift(anchor.getBoundingClientRect().left, panel.offsetWidth, document.documentElement.clientWidth)
}
const longName = computed(() => glyphs(`${rootName(props.p.root)} minor`))
const mine = computed(() => (props.p.picked ? ', your pick' : ''))
const ariaLabel = computed(() => props.p.basis === 'chord'
  ? `Pentatonic: ${longName.value}, rank ${props.p.rank}, ${props.p.shared} of 5 notes in ${props.p.scale}${mine.value}. Show the ranking`
  : `Pentatonic: ${longName.value}, ${props.p.shared} of 5 notes in ${props.p.key}${mine.value}. Show the ladder`)
type Row = Readonly<{ key: string; head: string; picks: readonly (PentatonicRung | PentatonicRank)[] }>
const rows = computed((): readonly Row[] => props.p.basis === 'chord'
  ? props.p.ranking.map((r) => ({ key: `r${r.rank}`, head: `${r.rank} · ${r.shared} shared`, picks: [r] }))
  : [0, 1, 2, 3, 4, 5, 6].map((rung) => {
      const picks = props.p.ladder.filter((x) => x.rung === rung)
      return { key: `g${rung}`, head: `${rung === 0 ? 'Home' : rung === 6 ? '6 Outside' : rung} · ${picks[0]?.shared ?? 0}`, picks }
    }))
const isCurrent = (x: PentatonicRung | PentatonicRank): boolean => x.name === props.p.name
function pick(x: PentatonicRung | PentatonicRank, close: () => void): void {
  emit('pick', pcOf(x.root))
  close()
}
function reset(close: () => void): void {
  emit('reset')
  close()
}
</script>
