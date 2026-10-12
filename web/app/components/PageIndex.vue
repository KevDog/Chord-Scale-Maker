<template>
  <!-- a page's "On this page": inline links under the intro below lg; from lg, a column beside the text that stays in
       view, the section being read marked -->
  <nav aria-label="On this page" :class="column ? 'sticky top-8 self-start max-lg:hidden print:hidden' : 'pt-2 lg:hidden'">
    <p v-if="column" class="mb-3 text-xs/5 font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">On this page</p>
    <ul :class="column ? 'space-y-2 border-l border-zinc-950/10 text-sm/5 dark:border-white/10' : 'flex flex-wrap gap-x-4 gap-y-1 text-sm/6'">
      <li v-for="s in sections" :key="s.id">
        <a
          :href="`#${s.id}`"
          :aria-current="column && s.id === current ? 'true' : undefined"
          :class="column
            ? ['-ml-px block border-l py-0.5 pl-4', s.id === current ? 'border-accent font-semibold text-accent' : 'border-transparent text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white']
            : 'text-zinc-950 underline decoration-zinc-950/50 hover:decoration-zinc-950 dark:text-white dark:decoration-white/50 dark:hover:decoration-white'"
        >{{ s.title }}</a>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
/** sections: the page's, in order; column: the sticky right-hand index (lg up), else the inline links; current: the section being read */
defineProps<{ sections: readonly Readonly<{ id: string; title: string }>[]; column?: boolean; current?: string }>()
</script>
