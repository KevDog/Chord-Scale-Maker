<template>
  <UiStackedLayout>
    <template #navbar>
      <UiNavbar>
        <UiNavbarItem href="/" aria-label="Chord Scale Maker, home">
          <img src="/favicon.svg" alt="" width="28" height="28" class="size-7 shrink-0">
          <UiNavbarLabel class="font-display text-lg font-bold tracking-tight">Chord <span class="text-accent">Scale</span> Maker</UiNavbarLabel>
        </UiNavbarItem>
        <UiNavbarDivider class="max-lg:hidden" />
        <UiNavbarSection class="max-lg:hidden" aria-label="Main">
          <UiNavbarItem href="/" :current="route.path === '/'">Library</UiNavbarItem>
          <UiNavbarItem v-if="newChart" href="/editor?new=1">New chart</UiNavbarItem>
          <UiNavbarItem href="/help" :current="route.path === '/help'">Help</UiNavbarItem>
          <UiNavbarItem href="/about" :current="route.path === '/about'">About</UiNavbarItem>
          <UiNavbarItem href="/contact" :current="route.path === '/contact'">Contact</UiNavbarItem>
        </UiNavbarSection>
        <UiNavbarSpacer />
        <HeaderQuote class="max-w-xl max-md:hidden" />
        <UiNavbarSection>
          <UiNavbarItem :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`" @click="toggle">
            <SunIcon v-if="theme === 'dark'" data-slot="icon" />
            <MoonIcon v-else data-slot="icon" />
          </UiNavbarItem>
        </UiNavbarSection>
      </UiNavbar>
    </template>
    <template #sidebar>
      <UiNavbarItem href="/"><BookOpenIcon data-slot="icon" />Library</UiNavbarItem>
      <UiNavbarItem v-if="newChart" href="/editor?new=1"><PlusIcon data-slot="icon" />New chart</UiNavbarItem>
      <UiNavbarItem href="/help"><QuestionMarkCircleIcon data-slot="icon" />Help</UiNavbarItem>
      <UiNavbarItem href="/about"><InformationCircleIcon data-slot="icon" />About</UiNavbarItem>
      <UiNavbarItem href="/contact"><EnvelopeIcon data-slot="icon" />Contact</UiNavbarItem>
    </template>
    <slot />
    <template #footer>
      <footer class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-4 pb-6 text-sm text-zinc-500 print:hidden lg:px-12 dark:text-zinc-400">
        <p>
          © {{ year }} Kevin Stevens. Provided as is, for practice and education.
          <span class="ml-1 text-xs whitespace-nowrap tabular-nums" :title="`Version ${version}: the date and commit this site was built from`">{{ version }}</span>
        </p>
        <div class="flex gap-2">
          <a
            v-for="s in SUPPORT"
            :key="s.name"
            :href="s.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Support me on ${s.name}`"
            :title="s.label"
            class="inline-flex items-center gap-1 rounded-md bg-note-800 px-2 py-0.5 text-xs/5 font-semibold text-white hover:bg-note-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-note-500 dark:bg-note-300 dark:text-zinc-950 dark:hover:bg-note-200"
          >
            <component :is="s.icon" class="size-3.5 opacity-80" aria-hidden="true" />{{ s.name }}
          </a>
        </div>
        <nav aria-label="Site" class="flex gap-4">
          <NuxtLink to="/help" class="hover:text-zinc-950 dark:hover:text-white">Help</NuxtLink>
          <NuxtLink to="/about" class="hover:text-zinc-950 dark:hover:text-white">About</NuxtLink>
          <NuxtLink to="/contact" class="hover:text-zinc-950 dark:hover:text-white">Contact</NuxtLink>
          <NuxtLink to="/privacy" class="hover:text-zinc-950 dark:hover:text-white">Privacy</NuxtLink>
        </nav>
      </footer>
    </template>
  </UiStackedLayout>
</template>

<script setup lang="ts">
import { BookOpenIcon, EnvelopeIcon, InformationCircleIcon, MoonIcon, PlusIcon, QuestionMarkCircleIcon, SunIcon } from '@heroicons/vue/20/solid'

/** the site chrome (Catalyst StackedLayout): navbar, mobile menu, theme toggle, footer */
const route = useRoute()
const { theme, toggle } = useTheme()
const newChart = useFeature('newChart')
const year = new Date().getFullYear() // the build's year: pages are prerendered
const version = useRuntimeConfig().public.version
</script>
