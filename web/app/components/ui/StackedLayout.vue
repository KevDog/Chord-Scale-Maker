<template>
  <div class="relative isolate flex min-h-svh w-full flex-col bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 print:bg-white">
    <!-- Sidebar on mobile -->
    <HTransitionRoot :show="menuOpen" as="template">
      <HDialog class="lg:hidden print:hidden" @close="menuOpen = false">
        <HTransitionChild as="template" enter="duration-300 ease-out" enter-from="opacity-0" enter-to="opacity-100" leave="duration-200 ease-in" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-black/30 transition" />
        </HTransitionChild>
        <HTransitionChild as="template" enter="duration-300 ease-in-out" enter-from="-translate-x-full" enter-to="translate-x-0" leave="duration-300 ease-in-out" leave-from="translate-x-0" leave-to="-translate-x-full">
          <HDialogPanel class="fixed inset-y-0 w-full max-w-80 p-2 transition">
            <div class="flex h-full flex-col rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
              <div class="-mb-3 px-4 pt-3">
                <UiNavbarItem aria-label="Close navigation" @click="menuOpen = false">
                  <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </UiNavbarItem>
              </div>
              <!-- clicking a link in the menu closes it -->
              <div class="flex flex-col gap-0.5 p-4" @click="onMenuClick">
                <slot name="sidebar" />
              </div>
            </div>
          </HDialogPanel>
        </HTransitionChild>
      </HDialog>
    </HTransitionRoot>

    <!-- Navbar -->
    <header class="flex items-center px-4 print:hidden">
      <div class="py-2.5 lg:hidden">
        <UiNavbarItem aria-label="Open navigation" @click="menuOpen = true">
          <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M2 6.75C2 6.33579 2.33579 6 2.75 6H17.25C17.6642 6 18 6.33579 18 6.75C18 7.16421 17.6642 7.5 17.25 7.5H2.75C2.33579 7.5 2 7.16421 2 6.75ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H17.25C17.6642 12.5 18 12.8358 18 13.25C18 13.6642 17.6642 14 17.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z" />
          </svg>
        </UiNavbarItem>
      </div>
      <div class="min-w-0 flex-1"><slot name="navbar" /></div>
    </header>

    <!-- Content -->
    <main class="flex flex-1 flex-col pb-2 lg:px-2 print:p-0">
      <div class="grow p-6 lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10 print:p-0 print:shadow-none print:ring-0 print:lg:bg-white">
        <div class="mx-auto max-w-6xl print:max-w-none"><slot /></div>
      </div>
    </main>

    <!-- outside <main>, so it is the page's footer landmark -->
    <slot name="footer" />
  </div>
</template>

<script setup lang="ts">
import { Dialog as HDialog, DialogPanel as HDialogPanel, TransitionChild as HTransitionChild, TransitionRoot as HTransitionRoot } from '@headlessui/vue'

/** Catalyst StackedLayout: a top navbar; below lg, a menu button opens #sidebar in a drawer */
const menuOpen = ref(false)
const onMenuClick = (e: MouseEvent): void => {
  if ((e.target as HTMLElement | null)?.closest('a')) menuOpen.value = false
}
</script>
