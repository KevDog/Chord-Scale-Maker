<template>
  <div class="lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12">
    <!-- from lg: the text, and its index in a column beside it -->
    <article class="max-w-3xl space-y-12">
      <header class="space-y-3">
        <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">How it decides</p>
        <UiHeading>How it decides</UiHeading>
        <UiText>
          Everything the app chooses for you, and the rule it uses: which scale, which guide tone, which pentatonic, how a
          note is spelled. Each section says what it decides, how, with an example, and what you can change.
          <UiTextLink href="/help">Help</UiTextLink> is the how-to; this is the why.
        </UiText>
        <div class="space-y-3 pt-2">
          <UiSubheading>A disclaimer</UiSubheading>
          <UiText>
            One critical thing to know about this site: music both is and isn't math. I'm not a PhD in music theory, and my
            degree is in computer science. I've been writing software for about thirty years and playing vibraphone for
            about ten. I know enough to make this work, but the logic behind the functional analysis was put together by
            compiling many internet resources and boiling them down to a series of logical tests.
          </UiText>
          <UiText>
            But jazz isn't made of logic, it's made of art. I'm not a good enough player to know if the analysis is right in all
            cases, and I don't have the time to check every tune in the library. If you see something that looks wrong,
            please <UiTextLink href="/contact">let me know</UiTextLink> and I'll fix it. The sections below say how each
            choice is made, and the note under a chord on the Changes sheet names the rule that chose its scale, so you
            can check the logic for yourself or tell me what to fix.
          </UiText>
        </div>
        <PageIndex :sections="SECTIONS" />
      </header>

      <section v-for="s in SECTIONS" :key="s.id" class="scroll-mt-6 space-y-8" :aria-labelledby="s.id">
        <UiSubheading :id="s.id" class="scroll-mt-6">{{ s.title }}</UiSubheading>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta } from '~/utils/site'

const SECTIONS = [
  { id: 'scales', title: 'Scales' },
  { id: 'keys', title: 'Keys' },
  { id: 'guide-tones', title: 'Guide tone lines' },
  { id: 'lines', title: 'The other lines' },
  { id: 'superimposing', title: 'Superimposing' },
  { id: 'spelling', title: 'Spelling' },
  { id: 'ranges', title: 'Ranges' },
]

const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD['how-it-decides']))
</script>
