<template>
  <span :class="['inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5 forced-colors:outline', badgeColors[color]]">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { type BadgeColor, badgeColors } from '~/utils/catalyst/badge'

withDefaults(defineProps<{ color?: BadgeColor }>(), { color: 'zinc' })
</script>
