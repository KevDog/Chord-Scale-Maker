<template>
  <span :class="[attrs.class, 'relative']">
    <!-- Catalyst animates this indicator between items with motion; here it is static -->
    <span v-if="current" class="absolute inset-x-2 -bottom-2.5 h-0.5 rounded-full bg-note-500 dark:bg-note-300" />
    <NuxtLink v-if="href !== undefined" v-interactive v-bind="rest" :to="href" :data-current="current ? 'true' : undefined" :aria-current="current ? 'page' : undefined" :class="CLASSES">
      <UiTouchTarget><slot /></UiTouchTarget>
    </NuxtLink>
    <button v-else v-interactive v-bind="rest" type="button" :data-current="current ? 'true' : undefined" :class="['cursor-default', CLASSES]">
      <UiTouchTarget><slot /></UiTouchTarget>
    </button>
  </span>
</template>

<script setup lang="ts">
import { vInteractive } from '~/utils/interactive'

/**
 * Catalyst NavbarItem: a link (href) or a button. Like Catalyst, `class` goes on the wrapper;
 * every other attribute and listener (aria-label, @click…) goes on the link or button itself.
 */
defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{ href?: string; current?: boolean }>(), { href: undefined })
const attrs = useAttrs()
const rest = computed(() => {
  const { class: _class, ...others } = attrs
  return others
})

const CLASSES = [
  // Base
  'relative flex min-w-0 items-center gap-3 rounded-lg p-2 text-left text-base/6 font-medium text-zinc-950 sm:text-sm/5',
  // Leading icon/icon-only
  '*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-500 sm:*:data-[slot=icon]:size-5',
  // Trailing icon (down chevron or similar)
  '*:not-nth-2:last:data-[slot=icon]:ml-auto *:not-nth-2:last:data-[slot=icon]:size-5 sm:*:not-nth-2:last:data-[slot=icon]:size-4',
  // Hover
  'data-hover:bg-zinc-950/5 data-hover:*:data-[slot=icon]:fill-zinc-950',
  // Active
  'data-active:bg-zinc-950/5 data-active:*:data-[slot=icon]:fill-zinc-950',
  // Dark mode
  'dark:text-white dark:*:data-[slot=icon]:fill-zinc-400',
  'dark:data-hover:bg-white/5 dark:data-hover:*:data-[slot=icon]:fill-white',
  'dark:data-active:bg-white/5 dark:data-active:*:data-[slot=icon]:fill-white',
]
</script>
