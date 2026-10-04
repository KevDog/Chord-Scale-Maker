<template>
  <td
    :class="[
      'relative px-4 first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
      !table?.striped && 'border-b border-zinc-950/5 dark:border-white/5',
      table?.grid && 'border-l border-l-zinc-950/5 first:border-l-0 dark:border-l-white/5',
      table?.dense ? 'py-2.5' : 'py-4',
      !table?.bleed && 'sm:first:pl-1 sm:last:pr-1',
    ]"
  >
    <slot />
  </td>
</template>

<script setup lang="ts">
import { TABLE } from '~/utils/table'

const table = inject(TABLE, undefined) // a ref, unwrapped in the template, so options stay reactive
</script>
