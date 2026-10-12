<template>
  <UiDropdown>
    <UiDropdownButton outline aria-label="More actions" title="More actions"><EllipsisHorizontalIcon data-slot="icon" /></UiDropdownButton>
    <UiDropdownMenu anchor="end">
      <UiDropdownItem v-for="a in items" :key="a" @click="emit('action', a)"><component :is="ITEMS[a].icon" data-slot="icon" />{{ ITEMS[a].label }}</UiDropdownItem>
    </UiDropdownMenu>
  </UiDropdown>
</template>

<script setup lang="ts">
import { ArrowDownTrayIcon, ArrowUturnLeftIcon, DocumentDuplicateIcon, EllipsisHorizontalIcon, FlagIcon } from '@heroicons/vue/16/solid'
import type { MoreAction } from '~/utils/moreMenu'

/** the rail's ⋯: the song page's less used actions (moreMenuItems decides which) */
defineProps<{ items: readonly MoreAction[] }>()
const emit = defineEmits<{ action: [action: MoreAction] }>()

const ITEMS = {
  copy: { label: 'Save as a copy', icon: DocumentDuplicateIcon },
  download: { label: 'Download', icon: ArrowDownTrayIcon },
  revert: { label: 'Revert to library version', icon: ArrowUturnLeftIcon },
  report: { label: 'Report a chart error', icon: FlagIcon },
} as const
</script>
