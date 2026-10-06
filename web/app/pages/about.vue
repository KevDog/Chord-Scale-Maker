<template>
  <article class="max-w-3xl space-y-12">
    <header>
      <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">About</p>
      <UiHeading>About Chord Scale Maker</UiHeading>
    </header>

    <section class="space-y-4" aria-labelledby="what">
      <UiSubheading id="what">What this is</UiSubheading>
      <UiText>
        Chord Scale Maker turns a chord chart into practice sheets: one staff per chord, with the scale that goes with
        it, written for your instrument. Pick a tune from the library or type your own changes, choose your
        instrument, and print.
      </UiText>
      <UiText>
        It's built for practising improvisation. Spell every scale from the same note to see exactly where the
        harmony moves. Follow the guide tones, the 3rds and 7ths, through a tune. Or pick a few notes from each scale
        and improvise with just those.
      </UiText>
    </section>

    <section class="space-y-4" aria-labelledby="thanks">
      <UiSubheading id="thanks">Thanks to Jazz Lab</UiSubheading>
      <UiText>
        This site started with a video from <UiTextLink href="https://jazzlabmusic.org/" external>Jazz Lab Music</UiTextLink>.
        If you're learning jazz, their <UiTextLink href="https://www.youtube.com/@jazzlabmusic" external>YouTube channel</UiTextLink>
        is a great place to spend time.
      </UiText>
      <VideoEmbed id="2SwqlkX-_HE" title="Chord Scale Theory Isn't Enough For Every Jazz Student – Here's Why">
        Jazz Lab Music, on YouTube. Chord Scale Maker is a thank-you, not affiliated with Jazz Lab.
      </VideoEmbed>
    </section>

    <section class="space-y-4" aria-labelledby="me">
      <UiSubheading id="me">Who made it</UiSubheading>
      <UiText>
        I'm Kevin Stevens, an engineer with a vibraphone habit. I built Chord Scale Maker for my own practice, and I
        hope it helps yours. Questions, ideas, or a tune you'd like in the library? <UiTextLink href="/contact">Get in touch</UiTextLink>.
      </UiText>
    </section>

    <section class="space-y-4" aria-labelledby="support">
      <UiSubheading id="support">Support the site</UiSubheading>
      <UiText>
        Chord Scale Maker is free, with no ads and no accounts, and I'd like to keep it that way. If it's helped your
        practice and you'd like to chip in toward hosting (and the occasional new pair of mallets), a one-off coffee or
        a monthly bit on Patreon both help. Thank you, it means a lot.
      </UiText>
      <!-- plain links, not the sites' widgets: nothing from them loads here, so the CSP stays first-party -->
      <div class="flex flex-wrap gap-3">
        <UiButton v-for="s in SUPPORT" :key="s.name" color="note" :href="s.url" target="_blank" rel="noopener noreferrer">
          <component :is="s.icon" data-slot="icon" />{{ s.label }}
        </UiButton>
      </div>
    </section>

    <section class="space-y-4" aria-labelledby="credits">
      <UiSubheading id="credits">Credits</UiSubheading>
      <UiText>Chord Scale Maker is built with open-source software, with thanks to its authors.</UiText>
      <ul class="space-y-1 text-sm/6 text-zinc-600 dark:text-zinc-400">
        <li v-for="c in CREDITS" :key="c.name">
          <UiTextLink :href="c.url" external>{{ c.name }}</UiTextLink>, {{ c.what }} ({{ c.licence }})
        </li>
      </ul>
      <UiText>
        Chord charts list chord changes only, with no melodies or lyrics. Quotes are attributed to the people who said
        them. Song titles and names belong to their owners.
      </UiText>
    </section>
  </article>
</template>

<script setup lang="ts">
import { HeartIcon, StarIcon } from '@heroicons/vue/16/solid'

/** ways to chip in, each a link to my page there */
const SUPPORT = [
  { name: 'ko-fi', label: 'Buy me a coffee on Ko-fi', url: 'https://ko-fi.com/kcstevens90266', icon: HeartIcon },
  { name: 'patreon', label: 'Become a patron on Patreon', url: 'https://www.patreon.com/kcstevens', icon: StarIcon },
] as const

const CREDITS = [
  { name: 'VexFlow', what: 'music notation', licence: 'MIT', url: 'https://www.vexflow.com/' },
  { name: 'Bravura', what: 'the music font, by Steinberg', licence: 'SIL Open Font License', url: 'https://github.com/steinbergmedia/bravura' },
  { name: 'Jost', what: 'the heading font, by indestructible type*', licence: 'SIL Open Font License', url: 'https://indestructibletype.com/Jost.html' },
  { name: 'Vue', what: 'the interface framework', licence: 'MIT', url: 'https://vuejs.org/' },
  { name: 'Nuxt', what: 'the site framework', licence: 'MIT', url: 'https://nuxt.com/' },
  { name: 'Headless UI', what: 'accessible components, by Tailwind Labs', licence: 'MIT', url: 'https://headlessui.com/' },
  { name: 'Heroicons', what: 'icons, by Tailwind Labs', licence: 'MIT', url: 'https://heroicons.com/' },
  { name: 'Tailwind CSS', what: 'styling', licence: 'MIT', url: 'https://tailwindcss.com/' },
  { name: 'Catalyst', what: 'the interface kit, by Tailwind Labs', licence: 'used under the Tailwind Plus licence', url: 'https://tailwindcss.com/plus' },
] as const

useHead({ title: 'About · Chord Scale Maker' })
</script>
