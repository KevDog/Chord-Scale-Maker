<template>
  <!-- a sentinel (no height, no margin) just above: once it scrolls out of view the rail is stuck (lg up), and lifts
       onto the raised surface -->
  <div ref="sentinel" aria-hidden="true" class="m-0! h-0" />
  <div
    role="toolbar"
    aria-label="Sheet controls"
    :data-stuck="stuck ? '' : undefined"
    class="-mx-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 rounded-paper p-3 transition-shadow lg:sticky lg:top-0 lg:z-10 lg:data-stuck:bg-raised lg:data-stuck:shadow-raised"
  >
    <div class="flex min-w-0 grow basis-80 flex-wrap items-start gap-x-4 gap-y-3"><slot name="left" /></div>
    <div class="ml-auto flex min-w-0 flex-wrap justify-end gap-2 *:whitespace-nowrap sm:shrink-0"><slot name="right" /></div>
  </div>
</template>

<script setup lang="ts">
/**
 * the song page's control rail: the sheet's settings at left, its actions at right (.interface-design/system.md).
 * Sticky from lg: its parents up to the Preview section are display: contents, so it sticks over the whole sheet.
 */
const sentinel = useTemplateRef<HTMLElement>('sentinel')
const stuck = ref(false)
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (!sentinel.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(([e]) => (stuck.value = !!e && !e.isIntersecting && e.boundingClientRect.top < 0))
  observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>
