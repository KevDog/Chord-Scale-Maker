<template>
  <!-- not in Catalyst: a non-selectable group heading inside a Listbox (Headless UI skips it when navigating) -->
  <div role="presentation" class="px-2 pt-2 pb-1 text-xs/5 font-semibold text-zinc-500 first:pt-1 sm:px-1.5 dark:text-zinc-400">
    <slot />
  </div>
</template>
