<template>
  <UiDialog :open="!!kind" size="md" @close="emit('close')">
    <form @submit.prevent="submit()">
      <UiDialogTitle>{{ TITLES[kind ?? 'section'] }}</UiDialogTitle>
      <UiDialogDescription v-if="description">{{ description }}</UiDialogDescription>
      <UiDialogBody class="space-y-4">
        <UiField v-if="kind === 'nav'">
          <UiLabel>Jump</UiLabel>
          <UiDescription>Where to go at the end of bar {{ bar }} of {{ section }}.</UiDescription>
          <UiSelect v-model="navText" autofocus>
            <option value="">None</option>
            <option v-for="t in navOptions" :key="t" :value="t">{{ t }}</option>
          </UiSelect>
        </UiField>
        <UiField v-else>
          <UiLabel>Section name</UiLabel>
          <UiInput v-model="name" autofocus :placeholder="kind === 'section' ? 'B' : ''" />
        </UiField>
        <UiField v-if="kind === 'section'">
          <UiLabel>First chords</UiLabel>
          <UiDescription>The section’s first bar: one chord, or more with spaces between.</UiDescription>
          <UiInput v-model="chords" placeholder="Cm7 F7" />
        </UiField>
        <UiText v-if="error" role="alert" class="text-sm/6! text-red-700! dark:text-red-400!">{{ error }}</UiText>
      </UiDialogBody>
      <UiDialogActions>
        <UiButton plain @click="emit('close')">Cancel</UiButton>
        <UiButton type="submit" color="note">{{ ACTIONS[kind ?? 'section'] }}</UiButton>
      </UiDialogActions>
    </form>
  </UiDialog>
</template>

<script setup lang="ts">
/**
 * The sheet editor's structure dialogs (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md §1.4): a new
 * section, a new section from a bar, and a jump. It only collects the fields; the editor makes the change and
 * passes back why it couldn't (`error`).
 */
const props = defineProps<{ kind: BarDialogKind | null; sections: readonly string[]; section: string; bar: number; beats: 2 | 3 | 4; error: string; nav?: string }>()
const emit = defineEmits<{ close: []; submit: [value: BarDialogSubmit] }>()

const TITLES: Readonly<Record<BarDialogKind, string>> = {
  section: 'Add a section',
  split: 'New section here',
  nav: 'Jump at the end of the bar',
}
const ACTIONS: Readonly<Record<BarDialogKind, string>> = { section: 'Add section', split: 'Start section', nav: 'Set' }

const description = computed(() => {
  switch (props.kind) {
    case 'section':
      return 'It goes after the last section: the form’s, or an intro’s or coda’s if you name it Intro, Coda or Tag.'
    case 'split':
      return `Bar ${props.bar} and the rest of ${props.section} become a section of their own.`
    default:
      return ''
  }
})

const name = ref('')
const chords = ref('')
const navText = ref(props.nav ?? '')
const navOptions = computed(() => (navText.value && !NAVS.includes(navText.value) ? [...NAVS, navText.value] : NAVS))
watch(
  () => props.kind,
  () => {
    name.value = ''
    chords.value = ''
    navText.value = props.nav ?? ''
  },
)

function submit(): void {
  const n = name.value.trim()
  switch (props.kind) {
    case 'section':
      return emit('submit', { kind: 'section', name: n, chords: chords.value.split(/\s+/).filter(Boolean) })
    case 'split':
      return emit('submit', { kind: 'split', name: n })
    case 'nav':
      return emit('submit', { kind: 'nav', text: navText.value })
  }
}
</script>

<script lang="ts">
/** the jumps a bar can end with (the bar toolbar's menu offers the same) */
export const NAVS = ['D.S. al Coda', 'D.S. al Fine', 'D.C. al Coda', 'D.C. al Fine', 'To Coda', 'Fine']
export type BarDialogKind = 'section' | 'split' | 'nav'
export type BarDialogSubmit =
  | Readonly<{ kind: 'section'; name: string; chords: readonly string[] }>
  | Readonly<{ kind: 'split'; name: string }>
  | Readonly<{ kind: 'nav'; text: string }>
</script>
