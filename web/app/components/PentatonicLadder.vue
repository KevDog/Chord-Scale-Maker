<template>
  <!-- a key area's pentatonic on the Changes sheet (#255); a click opens its tension ladder: pick another rung -->
  <HPopover class="relative inline-block max-w-full">
    <HPopoverButton
      :aria-label="`Pentatonic: ${current_.name}, ${current_.shared} of 5 notes in ${keyName}. Show the ladder`"
      class="block cursor-pointer rounded-sm text-left underline decoration-note-500/60 decoration-dotted underline-offset-[3px] hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500 dark:decoration-note-300/60 dark:hover:bg-white/5 print:no-underline"
    >{{ label }}</HPopoverButton>
    <HPopoverPanel v-slot="{ close }" role="dialog" :aria-label="`${keyName} ladder`" class="absolute top-full left-0 z-20 mt-2 w-64 rounded-paper bg-raised p-1.5 text-sm shadow-raised max-sm:w-[calc(100vw-2rem)] print:hidden">
      <p class="px-2 pt-1 pb-2 text-xs/4 font-medium text-zinc-500 dark:text-zinc-400">{{ keyName }} ladder</p>
      <ul>
        <li v-for="r in rungs" :key="r.rung" class="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1 px-2 py-1">
          <span class="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">{{ r.rung === 0 ? 'Home' : r.rung === 6 ? '6 Outside' : r.rung }} · {{ r.shared }}</span>
          <button
            v-for="p in r.picks"
            :key="p.name"
            type="button"
            data-pent
            :aria-current="isCurrent(p) ? 'true' : undefined"
            :class="['rounded-control px-2 py-0.5 text-left font-display font-semibold text-zinc-900 hover:bg-note-50 dark:text-white dark:hover:bg-white/5', isCurrent(p) && 'bg-note-100 text-note-800 dark:bg-note-300/15 dark:text-note-200', r.picks.length === 1 && 'col-span-2']"
            @click="pick(p, close)"
          >{{ p.name }}</button>
        </li>
      </ul>
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { pentatonicAt, type PentatonicRung, type PentatonicView } from '@chord-scale-maker/engine'

/** a Changes label and its key area's ladder: one row a rung (Home first), ♭ side then ♯ side; a pick sets the sheet's rung */
const props = defineProps<{ label: string; keyName: string; ladder: readonly PentatonicRung[]; current: PentatonicView }>()
const emit = defineEmits<{ pick: [view: PentatonicView] }>()
const current_ = computed(() => pentatonicAt(props.ladder, props.current))
const rungs = computed(() => [0, 1, 2, 3, 4, 5, 6].map((rung) => {
  const picks = props.ladder.filter((p) => p.rung === rung)
  return { rung, shared: picks[0]?.shared ?? 0, picks }
}))
const isCurrent = (p: PentatonicRung): boolean => p.name === current_.value.name
function pick(p: PentatonicRung, close: () => void): void {
  emit('pick', { rung: p.rung, side: p.side ?? props.current.side })
  close()
}
</script>
