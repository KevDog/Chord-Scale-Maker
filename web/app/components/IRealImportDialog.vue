<template>
  <UiDialog :open="open" size="lg" @close="emit('close')">
    <form @submit.prevent="submit">
      <UiDialogTitle>{{ report.length ? 'Some of it didn’t come across' : songs.length > 1 ? 'Choose a song' : 'Import from iReal Pro' }}</UiDialogTitle>
      <UiDialogDescription v-if="report.length">The chart opens without these. Charts are in concert pitch, as iReal Pro stores them.</UiDialogDescription>
      <UiDialogDescription v-else-if="songs.length > 1">{{ playlist || 'This playlist' }} has {{ songs.length }} songs. Import one at a time.</UiDialogDescription>
      <UiDialogDescription v-else>Paste a song or playlist link (irealb://…), copied from iReal Pro or its forums.</UiDialogDescription>
      <UiDialogBody>
        <ul v-if="report.length" class="list-disc space-y-1 pl-5 text-sm/6 text-zinc-700 dark:text-zinc-300">
          <li v-for="(d, i) in report" :key="i">{{ d.message }}</li>
        </ul>
        <UiField v-else-if="songs.length > 1">
          <UiLabel>Song</UiLabel>
          <UiSelect v-model="index" autofocus>
            <option v-for="(s, i) in songs" :key="i" :value="String(i)">{{ s.title }}</option>
          </UiSelect>
        </UiField>
        <UiField v-else>
          <UiLabel>Link</UiLabel>
          <UiTextarea v-model="text" rows="3" autofocus class="font-mono" :invalid="!!error" />
          <UiErrorMessage v-if="error">{{ error }}</UiErrorMessage>
        </UiField>
      </UiDialogBody>
      <UiDialogActions>
        <UiButton plain @click="emit('close')">Cancel</UiButton>
        <UiButton v-if="report.length" type="submit" color="note">Open anyway</UiButton>
        <UiButton v-else-if="songs.length > 1" type="submit" color="note" :disabled="busy">Open</UiButton>
        <UiButton v-else type="submit" color="note" :disabled="busy || !text.trim()">Import</UiButton>
      </UiDialogActions>
    </form>
  </UiDialog>
</template>

<script setup lang="ts">
import type { Diagnostic, IRealSong } from '@chord-scale-maker/engine'

/** Import iReal link…: a pasted link, then the song if it's a playlist, then what didn't come across (useOpenChart) */
const props = defineProps<{ open: boolean; songs: readonly IRealSong[]; playlist: string; report: readonly Diagnostic[]; error: string; busy: boolean }>()
const emit = defineEmits<{ link: [text: string]; choose: [index: number]; confirm: []; close: [] }>()

const text = ref('')
const index = ref('0')
watch(() => props.open, (o) => o && ((text.value = ''), (index.value = '0')))
watch(() => props.songs, () => (index.value = '0'))

function submit(): void {
  if (props.report.length) emit('confirm')
  else if (props.songs.length > 1) emit('choose', Number(index.value))
  else if (text.value.trim()) emit('link', text.value.trim())
}
</script>
