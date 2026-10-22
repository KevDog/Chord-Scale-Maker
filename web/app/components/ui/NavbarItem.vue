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
import { navbarItemClasses } from '~/utils/catalyst/navbar'
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

const CLASSES = navbarItemClasses
</script>
