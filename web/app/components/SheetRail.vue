<template>
  <!-- a sentinel (no height, no margin) just above: once it scrolls out of view the rail is stuck (lg up), and lifts
       onto the raised surface -->
  <div ref="sentinel" aria-hidden="true" class="m-0! h-0" />
  <div
    ref="rail"
    role="group"
    aria-label="Sheet controls"
    :data-stuck="sticky && stuck ? '' : undefined"
    :class="[
      '-mx-3 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-paper p-3 transition-shadow',
      sticky && 'lg:sticky lg:top-0 lg:z-10 lg:has-[[aria-haspopup][aria-expanded=true]]:z-40 lg:data-stuck:bg-raised lg:data-stuck:shadow-raised',
    ]"
  >
    <!-- the groups and the actions wrap as one row (the groups' box is display: contents), the actions pushed right
         wherever they land: beside the groups, they'd leave them half the width and three rows -->
    <div class="contents"><slot name="left" /></div>
    <div class="ml-auto flex min-w-0 flex-wrap justify-end gap-2 *:whitespace-nowrap sm:shrink-0"><slot name="right" /></div>
  </div>
</template>

<script setup lang="ts">
/**
 * the song page's control rail: the sheet's settings at left, its actions at right (.interface-design/system.md).
 * Sticky from lg while editing (practicing, it scrolls away: the notes are what matter): its parents up to the Preview section are display: contents, so it sticks over the whole sheet.
 * Below the sheet's popovers (z-10), except while one of its own menus is open; its height (--rail-h) sets how far
 * clear of it the sheet's controls scroll into view.
 */
/** sticky: from lg (the song page: while editing) */
const props = defineProps<{ sticky?: boolean }>()
const sentinel = useTemplateRef<HTMLElement>('sentinel')
const rail = useTemplateRef<HTMLElement>('rail')
const stuck = ref(false)
let observer: IntersectionObserver | undefined
let sized: ResizeObserver | undefined

onMounted(() => {
  if (rail.value && typeof ResizeObserver !== 'undefined') {
    sized = new ResizeObserver(([e]) => {
      if (e) height.value = Math.ceil(e.borderBoxSize[0]?.blockSize ?? e.contentRect.height)
    })
    sized.observe(rail.value)
  }
  if (!sentinel.value || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(([e]) => (stuck.value = !!e && !e.isIntersecting && e.boundingClientRect.top < 0))
  observer.observe(sentinel.value)
})
// how far clear of it the sheet's controls scroll into view: only while it sticks
const height = ref(0)
watchEffect(() => {
  if (!import.meta.client) return
  if (props.sticky && height.value) document.documentElement.style.setProperty('--rail-h', `${height.value}px`)
  else document.documentElement.style.removeProperty('--rail-h')
})
onBeforeUnmount(() => {
  observer?.disconnect()
  sized?.disconnect()
  document.documentElement.style.removeProperty('--rail-h')
})
</script>
