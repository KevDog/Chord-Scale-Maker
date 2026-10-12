<template>
  <!-- the whole quote in two lines at most (the longest cited is 151 characters), the author on a line under it: 54 px,
       inside the navbar's fixed 64. The title (a tooltip) is on a wrapper with no role, so it isn't read twice -->
  <div v-if="quote" :title="`“${quote.quote}” — ${quote.author}`" class="min-w-0">
    <figure class="text-white/90">
      <blockquote class="line-clamp-2 text-sm/[18px] text-balance italic">“{{ quote.quote }}”</blockquote>
      <figcaption class="mt-0.5 truncate text-xs/4 text-note-200">— {{ quote.author }}</figcaption>
    </figure>
  </div>
</template>

<script setup lang="ts">
/** this visit's quote, shown in the navbar */
const quote = useQuote()
</script>
