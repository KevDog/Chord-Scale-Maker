<template>
  <UiStackedLayout :bare="route.path.startsWith('/song')">
    <template #navbar>
      <UiNavbar>
        <UiNavbarItem href="/" aria-label="Chord Scale Maker, home">
          <img src="/favicon.svg" alt="" width="28" height="28" class="size-7 shrink-0 rounded-md ring-1 ring-white/30">
          <UiNavbarLabel class="font-display text-lg font-bold tracking-tight">Chord <span class="text-accent">Scale</span> Maker</UiNavbarLabel>
        </UiNavbarItem>
        <UiNavbarDivider class="max-lg:hidden" />
        <UiNavbarSection class="max-lg:hidden" aria-label="Main">
          <template v-for="e in NAV" :key="e.label">
            <UiNavbarDropdown v-if="isMenu(e)" :label="e.label" :current="isCurrent(e, route.path)">
              <UiDropdownItem v-for="i in e.items" :key="i.href" :href="i.href" :aria-current="isCurrent(i, route.path) ? 'page' : undefined">{{ i.label }}</UiDropdownItem>
            </UiNavbarDropdown>
            <UiNavbarItem v-else :href="e.href" :current="isCurrent(e, route.path)">{{ e.label }}</UiNavbarItem>
          </template>
        </UiNavbarSection>
        <UiNavbarSpacer />
        <HeaderQuote class="max-w-xl max-2xl:hidden" />
        <UiNavbarSection>
          <UiNavbarItem :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`" @click="toggle">
            <SunIcon v-if="theme === 'dark'" data-slot="icon" />
            <MoonIcon v-else data-slot="icon" />
          </UiNavbarItem>
        </UiNavbarSection>
      </UiNavbar>
    </template>
    <template #sidebar>
      <!-- the phone menu: every page, flat (a dropdown inside it would only add a tap) -->
      <UiNavbarItem v-for="l in navLinks(NAV)" :key="l.href" :href="l.href"><component :is="l.icon" data-slot="icon" />{{ l.label }}</UiNavbarItem>
    </template>
    <slot />
    <template #footer>
      <footer class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-4 pb-6 text-sm text-zinc-600 print:hidden lg:px-12 dark:text-zinc-400">
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
        <nav aria-label="Site" class="flex flex-wrap gap-x-4 gap-y-1">
          <NuxtLink to="/help" class="hover:text-zinc-950 dark:hover:text-white">Help</NuxtLink>
          <NuxtLink to="/how-it-decides" class="hover:text-zinc-950 dark:hover:text-white">How it decides</NuxtLink>
          <NuxtLink to="/release-notes" class="hover:text-zinc-950 dark:hover:text-white">Release notes</NuxtLink>
          <NuxtLink to="/functions" class="hover:text-zinc-950 dark:hover:text-white">Functions</NuxtLink>
          <NuxtLink to="/scales" class="hover:text-zinc-950 dark:hover:text-white">Scales</NuxtLink>
          <NuxtLink to="/chords" class="hover:text-zinc-950 dark:hover:text-white">Chords</NuxtLink>
          <NuxtLink to="/composers" class="hover:text-zinc-950 dark:hover:text-white">Composers</NuxtLink>
          <NuxtLink to="/about" class="hover:text-zinc-950 dark:hover:text-white">About</NuxtLink>
          <NuxtLink to="/contact" class="hover:text-zinc-950 dark:hover:text-white">Contact</NuxtLink>
          <NuxtLink to="/privacy" class="hover:text-zinc-950 dark:hover:text-white">Privacy</NuxtLink>
        </nav>
      </footer>
    </template>
  </UiStackedLayout>
</template>

<script setup lang="ts">
import { MoonIcon, SunIcon } from '@heroicons/vue/20/solid'
import { isCurrent, isMenu, NAV, navLinks } from '~/utils/siteNav'

/** the site chrome (Catalyst StackedLayout): navbar, mobile menu, theme toggle, footer */
const route = useRoute()
const { theme, toggle } = useTheme()
const year = new Date().getFullYear() // the build's year: pages are prerendered
const version = useRuntimeConfig().public.version
</script>
