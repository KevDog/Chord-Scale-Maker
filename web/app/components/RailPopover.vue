<template>
  <!-- inline: stacked under its toggle (in the Controls dialog); else a chevron whose panel opens to its right, over the sheet, so the rail keeps its rows (#293) -->
  <div v-if="inline" class="flex flex-col items-start gap-2"><slot /></div>
  <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- Escape from the button or panel inside bubbles here -->
  <div v-else ref="root" class="relative" @keydown.esc="close">
    <UiButton ref="button" plain :aria-label="label" :aria-expanded="open" aria-haspopup="dialog" @click="open = !open">
      <ChevronRightIcon data-slot="icon" />
    </UiButton>
    <Transition name="ease-fade">
      <div v-if="open" role="dialog" :aria-label="label" class="absolute top-0 left-full z-20 ml-2 flex w-max flex-col items-start gap-2 rounded-paper bg-raised p-3 shadow-raised max-sm:top-full max-sm:left-0 max-sm:mt-2 max-sm:ml-0 print:hidden">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ChevronRightIcon } from '@heroicons/vue/16/solid'

/** a toggle's options, opened beside it: open stays until a click outside, Escape, or the chevron again */
defineProps<{ label: string; inline?: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const root = ref<HTMLElement | null>(null)
const button = ref<{ $el: HTMLElement } | null>(null)

function close(): void {
  if (!open.value) return
  open.value = false
  button.value?.$el.focus()
}
function outside(e: PointerEvent): void {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
watch(open, (o) => (o ? document.addEventListener('pointerdown', outside) : document.removeEventListener('pointerdown', outside)))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
