<template>
  <UiDropdown>
    <UiDropdownButton outline aria-label="More actions" title="More actions"><EllipsisHorizontalIcon data-slot="icon" /></UiDropdownButton>
    <UiDropdownMenu anchor="end">
      <!-- the Interface level (#273): how many controls show -->
      <div class="col-span-full px-3.5 pt-1 pb-0.5 text-xs/5 font-medium text-zinc-500 sm:px-3 dark:text-zinc-400" aria-hidden="true">Interface</div>
      <UiDropdownItem v-for="l in INTERFACE_LEVELS" :key="l" :data-level="l" @click="ui.level.value = l">
        <CheckIcon v-if="ui.level.value === l" data-slot="icon" /><span v-else data-slot="icon" aria-hidden="true" />{{ levelLabel(l) }}<span v-if="ui.level.value === l" class="sr-only"> (current)</span>
      </UiDropdownItem>
      <div role="separator" class="col-span-full mx-3.5 my-1 h-px bg-zinc-950/5 sm:mx-3 dark:bg-white/10" />
      <UiDropdownItem v-for="a in items" :key="a" @click="emit('action', a)"><component :is="ITEMS[a].icon" data-slot="icon" />{{ ITEMS[a].label }}</UiDropdownItem>
    </UiDropdownMenu>
  </UiDropdown>
</template>

<script setup lang="ts">
import { ArrowDownTrayIcon, ArrowPathIcon, ArrowUturnLeftIcon, CheckIcon, DocumentDuplicateIcon, EllipsisHorizontalIcon, FlagIcon } from '@heroicons/vue/16/solid'
import type { MoreAction } from '~/utils/moreMenu'
import { INTERFACE_LEVELS, levelLabel } from '~/utils/interface'

/** the rail's ⋯: the Interface level, then the song page's less used actions (moreMenuItems decides which) */
defineProps<{ items: readonly MoreAction[] }>()
const emit = defineEmits<{ action: [action: MoreAction] }>()
const ui = useInterface()

const ITEMS = {
  copy: { label: 'Save as a copy', icon: DocumentDuplicateIcon },
  download: { label: 'Download', icon: ArrowDownTrayIcon },
  revert: { label: 'Revert to library version', icon: ArrowUturnLeftIcon },
  'reset-picks': { label: 'Reset chord picks', icon: ArrowPathIcon },
  report: { label: 'Report a chart error', icon: FlagIcon },
} as const
</script>
