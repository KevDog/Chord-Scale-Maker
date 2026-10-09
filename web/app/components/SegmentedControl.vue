<template>
  <!-- Application UI button-group pattern over native radios, so arrow keys and forms work as usual -->
  <fieldset>
    <legend class="sr-only">{{ legend }}</legend>
    <span class="isolate inline-flex rounded-lg shadow-xs dark:shadow-none">
      <label
        v-for="o in options"
        :key="o.value"
        class="relative -ml-px inline-flex cursor-default items-center bg-white px-3 py-2 text-sm/5 lg:px-2.5 font-semibold text-zinc-950 ring-1 ring-zinc-950/10 ring-inset first:ml-0 first:rounded-l-lg last:rounded-r-lg hover:bg-zinc-50 has-checked:z-10 has-checked:bg-note-500 has-checked:text-white has-checked:ring-note-600 has-focus-visible:z-20 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-note-500 dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10 dark:has-checked:bg-note-300 dark:has-checked:text-zinc-950"
      >
        <input v-model="model" type="radio" :name="name" :value="o.value" class="sr-only">{{ o.label }}
      </label>
    </span>
  </fieldset>
</template>

<script setup lang="ts" generic="T extends string">
/** a row of joined toggle buttons for one choice (From C / From root) */
defineProps<{ legend: string; name: string; options: readonly { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })
</script>
