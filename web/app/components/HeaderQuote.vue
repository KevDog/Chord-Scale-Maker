<template>
  <!-- one line whatever its length, so the navbar never changes height; the whole quote is in the title (screen readers
       get it all from the text, which is only clipped) -->
  <figure v-if="quote" :title="`“${quote.quote}” — ${quote.author}`" class="min-w-0 truncate text-sm/5 text-zinc-700 dark:text-zinc-300">
    <blockquote class="inline italic">“{{ quote.quote }}”</blockquote>
    <figcaption class="inline text-zinc-600 dark:text-zinc-400"> — {{ quote.author }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
/** this visit's quote, shown in the navbar */
const quote = useQuote()
</script>
