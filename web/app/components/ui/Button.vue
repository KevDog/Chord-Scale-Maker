<template>
  <NuxtLink v-if="href !== undefined" v-interactive :to="href" :class="classes">
    <UiTouchTarget><slot /></UiTouchTarget>
  </NuxtLink>
  <button
    v-else
    v-interactive
    :type="type"
    :disabled="disabled"
    :data-disabled="dataFlag(disabled)"
    :class="[classes, 'cursor-default']"
  >
    <UiTouchTarget><slot /></UiTouchTarget>
  </button>
</template>

<script setup lang="ts">
import { type ButtonColor, buttonStyles } from '~/utils/catalyst/button'
import { dataFlag, vInteractive } from '~/utils/interactive'

/** Catalyst Button: solid (with a colour), outline or plain; a link when given an href */
const props = withDefaults(
  defineProps<{
    color?: ButtonColor
    outline?: boolean
    plain?: boolean
    href?: string
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  { color: undefined, href: undefined, type: 'button' },
)

const classes = computed(() => [
  buttonStyles.base,
  props.outline
    ? buttonStyles.outline
    : props.plain
      ? buttonStyles.plain
      : [buttonStyles.solid, buttonStyles.colors[props.color ?? 'dark/zinc']],
])
</script>
