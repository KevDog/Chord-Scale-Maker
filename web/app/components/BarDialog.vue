<template>
  <UiDialog :open="!!kind" size="md" @close="emit('close')">
    <form @submit.prevent="submit()">
      <UiDialogTitle>{{ TITLES[kind ?? 'section'] }}</UiDialogTitle>
      <UiDialogDescription v-if="description">{{ description }}</UiDialogDescription>
      <UiDialogBody class="space-y-4">
        <UiField v-if="kind === 'repeat'">
          <UiLabel>Section to repeat</UiLabel>
          <UiSelect v-model="src">
            <option v-for="s in sections" :key="s" :value="s">{{ s }}</option>
          </UiSelect>
        </UiField>
        <UiField v-if="kind === 'nav'">
          <UiLabel>Jump</UiLabel>
          <UiDescription>Where to go at the end of bar {{ bar }} of {{ section }}.</UiDescription>
          <UiSelect v-model="navText" autofocus>
            <option value="">None</option>
            <option v-for="t in navOptions" :key="t" :value="t">{{ t }}</option>
          </UiSelect>
        </UiField>
        <UiField v-else-if="kind !== 'paste'">
          <UiLabel>{{ kind === 'repeat' ? 'Name of the repeat' : 'Section name' }}</UiLabel>
          <UiInput v-model="name" autofocus :placeholder="kind === 'section' ? 'B' : ''" />
        </UiField>
        <UiField v-if="kind === 'section'">
          <UiLabel>First chords</UiLabel>
          <UiDescription>The section’s first bar: one chord, or more with spaces between.</UiDescription>
          <UiInput v-model="chords" placeholder="Cm7 F7" />
        </UiField>
        <UiField v-if="kind === 'paste'">
          <UiLabel>Bars</UiLabel>
          <UiDescription>Chords between bar lines, in concert pitch: <UiCode>| Cm7 | F7 | Bm7 E7 |</UiCode>. An empty bar holds the chord before.</UiDescription>
          <UiTextarea v-model="text" rows="4" autofocus :invalid="!!pasted.diagnostics.length" class="font-mono" />
        </UiField>
        <ul v-if="kind === 'paste' && pasted.diagnostics.length" role="alert" class="list-disc pl-5 text-sm/6 text-red-700 dark:text-red-400">
          <li v-for="(d, i) in pasted.diagnostics" :key="i">Line {{ d.line }}: {{ d.message }}</li>
        </ul>
        <UiText v-else-if="kind === 'paste' && pasted.value.length" class="text-sm/6!">{{ pasted.value.length === 1 ? '1 bar' : `${pasted.value.length} bars` }}</UiText>
        <UiText v-if="error" role="alert" class="text-sm/6! text-red-700! dark:text-red-400!">{{ error }}</UiText>
      </UiDialogBody>
      <UiDialogActions>
        <UiButton plain @click="emit('close')">Cancel</UiButton>
        <template v-if="kind === 'paste'">
          <UiButton outline :disabled="!canPaste" @click="submit(true)">Insert before bar {{ bar }}</UiButton>
          <UiButton type="submit" color="note" :disabled="!canPaste">Insert after bar {{ bar }}</UiButton>
        </template>
        <UiButton v-else type="submit" color="note">{{ ACTIONS[kind ?? 'section'] }}</UiButton>
      </UiDialogActions>
    </form>
  </UiDialog>
</template>

<script setup lang="ts">
import { type Beats, parseBarLine } from '@chord-scale-maker/engine'

/**
 * The sheet editor's structure dialogs (docs/superpowers/specs/2026-10-11-lead-sheet-editor-design.md §1.4, §1.5): a
 * new section, a new section from a bar, a jump, pasted bars, a repeat of a section and a section's new name. It
 * only collects the fields; the editor makes the change and passes back why it couldn't (`error`).
 */
const props = defineProps<{ kind: BarDialogKind | null; sections: readonly string[]; section: string; bar: number; beats: Beats; error: string; nav?: string }>()
const emit = defineEmits<{ close: []; submit: [value: BarDialogSubmit] }>()

const TITLES: Readonly<Record<BarDialogKind, string>> = {
  section: 'Add a section',
  repeat: 'Repeat a section',
  paste: 'Paste bars',
  rename: 'Rename section',
  split: 'New section here',
  nav: 'Jump at the end of the bar',
}
const ACTIONS: Readonly<Record<Exclude<BarDialogKind, 'paste'>, string>> = { section: 'Add section', repeat: 'Repeat', rename: 'Rename', split: 'Start section', nav: 'Set' }

const description = computed(() => {
  switch (props.kind) {
    case 'section':
      return 'It goes after the last section: the form’s, or an intro’s or coda’s if you name it Intro, Coda or Tag.'
    case 'repeat':
      return 'The repeat plays the section’s bars again after the last section. It changes when the section does, until you write it out.'
    case 'rename':
      return `Renames ${props.section} everywhere the chart names it.`
    case 'split':
      return `Bar ${props.bar} and the rest of ${props.section} become a section of their own.`
    default:
      return ''
  }
})

const name = ref('')
const chords = ref('')
const src = ref('')
const text = ref('')
const navText = ref(props.nav ?? '')
const navOptions = computed(() => (navText.value && !NAVS.includes(navText.value) ? [...NAVS, navText.value] : NAVS))
watch(
  () => props.kind,
  (k) => {
    name.value = k === 'rename' ? props.section : ''
    chords.value = ''
    src.value = props.sections.includes(props.section) ? props.section : (props.sections[0] ?? '')
    text.value = ''
    navText.value = props.nav ?? ''
  },
  { immediate: true },
)

const pasted = computed(() => parseBarLine(text.value, props.beats))
const canPaste = computed(() => !!pasted.value.value.length && !pasted.value.diagnostics.length)

function submit(before = false): void {
  const n = name.value.trim()
  switch (props.kind) {
    case 'section':
      return emit('submit', { kind: 'section', name: n, chords: chords.value.split(/\s+/).filter(Boolean) })
    case 'repeat':
      return emit('submit', { kind: 'repeat', src: src.value, name: n })
    case 'paste':
      if (canPaste.value) emit('submit', { kind: 'paste', bars: pasted.value.value, before })
      return
    case 'rename':
    case 'split':
      return emit('submit', { kind: props.kind, name: n })
    case 'nav':
      return emit('submit', { kind: 'nav', text: navText.value })
  }
}
</script>

<script lang="ts">
/** the jumps a bar can end with (the bar toolbar's menu offers the same) */
export const NAVS = ['D.S. al Coda', 'D.S. al Fine', 'D.C. al Coda', 'D.C. al Fine', 'To Coda', 'Fine']
export type BarDialogKind = 'section' | 'repeat' | 'paste' | 'rename' | 'split' | 'nav'
export type BarDialogSubmit =
  | Readonly<{ kind: 'section'; name: string; chords: readonly string[] }>
  | Readonly<{ kind: 'repeat'; src: string; name: string }>
  | Readonly<{ kind: 'paste'; bars: readonly (readonly string[])[]; before: boolean }>
  | Readonly<{ kind: 'rename' | 'split'; name: string }>
  | Readonly<{ kind: 'nav'; text: string }>
</script>
