<template>
  <div class="flow-root">
    <div class="-mx-(--gutter) overflow-x-auto whitespace-nowrap">
      <div :class="['inline-block min-w-full align-middle', !bleed && 'sm:px-(--gutter)']">
        <table class="min-w-full text-left text-sm/6 text-zinc-950 dark:text-white"><slot /></table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TABLE } from '~/utils/table'

const props = defineProps<{ bleed?: boolean; dense?: boolean; grid?: boolean; striped?: boolean }>()
provide(
  TABLE,
  computed(() => ({ bleed: props.bleed, dense: props.dense, grid: props.grid, striped: props.striped })),
)
</script>
