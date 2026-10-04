<template>
  <HTransitionRoot :show="open" as="template">
    <HDialog class="relative z-50" @close="emit('close')">
      <HTransitionChild
        as="template"
        enter="ease-out duration-100"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-100"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 flex w-screen justify-center overflow-y-auto bg-zinc-950/25 px-2 py-2 transition focus:outline-0 sm:px-6 sm:py-8 lg:px-8 lg:py-16 dark:bg-zinc-950/50" />
      </HTransitionChild>
      <div class="fixed inset-0 w-screen overflow-y-auto pt-6 sm:pt-0">
        <div class="grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4">
          <HTransitionChild
            as="template"
            enter="ease-out duration-100"
            enter-from="translate-y-12 opacity-0 sm:translate-y-0 sm:scale-95"
            enter-to="translate-y-0 opacity-100 sm:scale-100"
            leave="ease-in duration-100"
            leave-from="translate-y-0 opacity-100"
            leave-to="translate-y-12 opacity-0 sm:translate-y-0"
          >
            <HDialogPanel
              :class="[
                SIZES[size],
                'row-start-2 w-full min-w-0 rounded-t-3xl bg-white p-(--gutter) shadow-lg ring-1 ring-zinc-950/10 [--gutter:--spacing(8)] sm:mb-auto sm:rounded-2xl dark:bg-zinc-900 dark:ring-white/10 forced-colors:outline',
                'transition will-change-transform',
              ]"
            >
              <slot />
            </HDialogPanel>
          </HTransitionChild>
        </div>
      </div>
    </HDialog>
  </HTransitionRoot>
</template>

<script setup lang="ts">
import { Dialog as HDialog, DialogPanel as HDialogPanel, TransitionChild as HTransitionChild, TransitionRoot as HTransitionRoot } from '@headlessui/vue'

/** Catalyst Dialog on @headlessui/vue: focus is trapped while open; Escape or the backdrop emits close */
withDefaults(defineProps<{ open: boolean; size?: keyof typeof SIZES }>(), { size: 'lg' })
const emit = defineEmits<{ close: [] }>()
</script>

<script lang="ts">
const SIZES = {
  xs: 'sm:max-w-xs',
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
} as const
</script>
