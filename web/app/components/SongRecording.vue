<template>
  <!-- a library tune's notable recording, in the prerendered page too: what to learn it from -->
  <section aria-labelledby="recording-heading" class="mt-10 max-w-2xl print:hidden">
    <UiSubheading id="recording-heading" :level="2">Recording</UiSubheading>
    <UiText class="mt-2">{{ parts.artist }}, <em>{{ parts.album }}</em>{{ parts.tail }}</UiText>
    <template v-if="youtube && embeddable">
      <VideoEmbed :id="youtube" class="mt-4" :title="`${title}, ${recording.artist}`">{{ recording.artist }}, on YouTube.</VideoEmbed>
      <UiText class="mt-2"><UiTextLink :href="youtubeUrl(youtube)" external>Watch on YouTube</UiTextLink></UiText>
    </template>
    <!-- a label's upload that won't play on other sites: its page on YouTube only (#363) -->
    <UiText v-else-if="youtube" class="mt-2"><UiTextLink :href="youtubeUrl(youtube)" external>Listen on YouTube<span aria-hidden="true"> ↗</span></UiTextLink></UiText>
  </section>
</template>

<script setup lang="ts">
import type { Recording } from '@chord-scale-maker/engine'
import { recordingParts, youtubeUrl } from '~/utils/recording'

const props = withDefaults(defineProps<{ recording: Recording; youtube: string; embeddable?: boolean; title: string }>(), { embeddable: true })
const parts = computed(() => recordingParts(props.recording))
</script>
