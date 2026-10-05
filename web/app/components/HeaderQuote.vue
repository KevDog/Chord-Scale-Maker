<template>
  <figure v-if="quote" class="min-w-0 text-sm/5 text-zinc-700 dark:text-zinc-300">
    <blockquote class="line-clamp-2 italic">“{{ quote.quote }}”</blockquote>
    <figcaption class="mt-0.5 truncate text-zinc-600 dark:text-zinc-400">— {{ quote.author }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
/** this visit's quote, shown in the navbar */
const quote = useQuote()
</script>
