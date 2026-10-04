<template>
  <tr :class="[table?.striped && 'even:bg-zinc-950/2.5 dark:even:bg-white/2.5']"><slot /></tr>
</template>

<script setup lang="ts">
import { TABLE } from '~/utils/table'

const table = inject(TABLE, undefined) // a ref, unwrapped in the template, so options stay reactive
</script>
