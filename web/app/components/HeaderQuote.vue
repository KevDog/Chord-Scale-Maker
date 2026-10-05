<template>
  <figure v-if="quote" class="min-w-0 text-xs/4 text-zinc-500 dark:text-zinc-400">
    <blockquote class="line-clamp-2 italic">“{{ quote.quote }}”</blockquote>
    <figcaption class="mt-0.5 truncate">— {{ quote.author }}<template v-if="quote.topic"> · {{ quote.topic }}</template></figcaption>
  </figure>
</template>

<script setup lang="ts">
/** this visit's quote, shown in the navbar */
const quote = useQuote()
</script>
