<template>
  <UiStackedLayout>
    <template #navbar>
      <UiNavbar>
        <UiNavbarItem href="/" aria-label="Chord Scale Maker, home">
          <UiNavbarLabel class="text-base font-semibold tracking-tight">Chord <span class="text-accent">Scale</span> Maker</UiNavbarLabel>
        </UiNavbarItem>
        <UiNavbarDivider class="max-lg:hidden" />
        <UiNavbarSection class="max-lg:hidden" aria-label="Main">
          <UiNavbarItem href="/" :current="route.path === '/'">Library</UiNavbarItem>
          <UiNavbarItem v-if="newChart" href="/editor?new=1">New chart</UiNavbarItem>
        </UiNavbarSection>
        <UiNavbarSpacer />
        <HeaderQuote class="max-w-md max-md:hidden" />
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
    </template>
    <slot />
  </UiStackedLayout>
</template>

<script setup lang="ts">
import { BookOpenIcon, MoonIcon, PlusIcon, SunIcon } from '@heroicons/vue/20/solid'

/** the site chrome (Catalyst StackedLayout): navbar, mobile menu, theme toggle */
const route = useRoute()
const { theme, toggle } = useTheme()
const newChart = useFeature('newChart')
</script>
