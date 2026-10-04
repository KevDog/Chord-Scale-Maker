<template>
  <HDialogDescription class="mt-2 text-base/6 text-pretty text-zinc-500 sm:text-sm/6 dark:text-zinc-400"><slot /></HDialogDescription>
</template>

<script setup lang="ts">
import { DialogDescription as HDialogDescription } from '@headlessui/vue'
</script>
