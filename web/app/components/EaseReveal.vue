<template>
  <!-- the wrapper's one grid row grows from 0fr as the content fades in, and shrinks back as it leaves, so what's below slides (#297; main.css .ease-*) -->
  <Transition name="ease">
    <div v-if="show" v-bind="$attrs" class="ease-grid"><div class="ease-inner" :class="innerClass"><slot /></div></div>
  </Transition>
</template>

<script setup lang="ts">
/** controls that come and go with an option, eased in and out rather than popping; class goes on the wrapper, innerClass on the content's box */
defineOptions({ inheritAttrs: false })
defineProps<{ show: boolean; innerClass?: string }>()
</script>
