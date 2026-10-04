<template>
  <th
    :class="[
      'relative border-b border-b-zinc-950/10 px-4 py-2 font-medium first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2)) dark:border-b-white/10',
      table?.grid && 'border-l border-l-zinc-950/5 first:border-l-0 dark:border-l-white/5',
      !table?.bleed && 'sm:first:pl-1 sm:last:pr-1',
    ]"
  >
    <slot />
  </th>
</template>

<script setup lang="ts">
import { TABLE } from '~/utils/table'

const table = inject(TABLE, undefined) // a ref, unwrapped in the template, so options stay reactive
</script>
