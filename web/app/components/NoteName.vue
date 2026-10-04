<template>
  <span>{{ LETTERS[note.letter] }}<span v-if="note.acc" class="not-italic">{{ accidental }}</span></span>
</template>

<script setup lang="ts">
import { LETTERS, type Spelled } from '~~/engine'

const props = defineProps<{ note: Spelled }>()
const accidental = computed(() => (props.note.acc > 0 ? '♯' : '♭').repeat(Math.abs(props.note.acc)))
</script>
