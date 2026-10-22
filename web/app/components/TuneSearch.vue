<template>
  <HCombobox v-model="picked" as="div" class="relative" nullable @update:model-value="go">
    <div class="flex flex-wrap items-center gap-x-2 rounded-paper bg-paper pr-2.5 pl-5 shadow-paper sm:h-16 max-sm:pb-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-note-500 max-sm:pl-3.5 dark:focus-within:outline-note-300">
      <MagnifyingGlassIcon class="size-5.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
      <HComboboxInput
        ref="input"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="Search by title or composer"
        aria-label="Search by title or composer"
        :display-value="() => query"
        class="h-full min-w-0 flex-1 bg-transparent max-sm:h-13 px-1 text-xl text-zinc-900 placeholder:text-zinc-400 focus:outline-none max-sm:text-[17px] dark:text-white dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
        @change="query = ($event.target as HTMLInputElement).value"
      />
      <kbd v-if="!query" class="rounded border border-zinc-950/10 px-1.5 py-1 font-sans text-xs/none font-medium text-zinc-400 max-sm:hidden dark:border-white/10 dark:text-zinc-500" title="Press / to search">/</kbd>
      <!-- the instrument is this browser's (csm-instrument), so it waits for the browser -->
      <ClientOnly>
        <UiListbox v-model="instrument" aria-label="Instrument" class="w-full shrink-0 sm:w-48">
          <template #selected="{ value }"><UiListboxLabel>{{ instrumentOption(value) }}</UiListboxLabel></template>
          <UiListboxGroup v-for="g in INSTRUMENT_GROUPS" :key="g.label" :label="g.label">
            <UiListboxOption v-for="name in g.instruments" :key="name" :value="name">
              <UiListboxLabel>{{ instrumentOption(name) }}</UiListboxLabel>
            </UiListboxOption>
          </UiListboxGroup>
        </UiListbox>
        <template #fallback><span class="w-full shrink-0 sm:w-48" /></template>
      </ClientOnly>
    </div>

    <HComboboxOptions v-if="query.trim()" class="absolute inset-x-0 top-full z-20 mt-2 rounded-paper bg-raised p-1.5 shadow-raised">
      <HComboboxOption v-for="c in found.tunes" :key="c.slug" v-slot="{ active }" :value="c.slug" as="template">
        <li :class="[active && 'bg-note-100 dark:bg-note-300/15', 'grid cursor-pointer grid-cols-[1fr_auto] items-center gap-4 rounded-control px-3 py-2.5']">
          <span class="min-w-0">
            <span class="block text-[15px]/[22px] font-semibold text-zinc-900 dark:text-white">
              <template v-for="(part, i) in titleParts(c.title)" :key="i"><mark v-if="i === 1" class="bg-transparent text-accent underline decoration-[1.5px] underline-offset-3">{{ part }}</mark><template v-else>{{ part }}</template></template>
            </span>
            <span class="block truncate text-[13px]/[18px] text-zinc-500 dark:text-zinc-400">{{ [c.composer, c.details.split(' · ')[0]].filter(Boolean).join(' · ') }}</span>
          </span>
          <span v-if="c.key" class="text-right">
            <span class="block font-display text-[22px]/none font-semibold text-zinc-900 tabular-nums dark:text-white" aria-hidden="true">{{ keyName(written(c.key)) }}</span>
            <span v-if="transposing" class="mt-1 block text-[11px]/[14px] whitespace-nowrap text-zinc-500 dark:text-zinc-400" aria-hidden="true">concert {{ keyName(c.key) }}</span>
            <span class="sr-only">in {{ keyName(written(c.key)) }}{{ transposing ? `, concert ${keyName(c.key)}` : '' }}</span>
          </span>
        </li>
      </HComboboxOption>
      <HComboboxOption v-if="found.total > found.tunes.length" v-slot="{ active }" :value="ALL" as="template">
        <li :class="[active && 'bg-note-100 dark:bg-note-300/15', 'mt-1 cursor-pointer rounded-control border-t border-zinc-950/5 px-3 py-2.5 font-semibold text-accent dark:border-white/5']">
          See all {{ found.total }} in the library →
        </li>
      </HComboboxOption>
      <li v-else-if="!found.total" class="px-3 py-3.5 text-zinc-500 dark:text-zinc-400">
        No tune matches “{{ query.trim() }}”. <UiTextLink href="/contact">Request it</UiTextLink> or <UiTextLink href="/song?new=1">start a new chart</UiTextLink>.
      </li>
    </HComboboxOptions>
  </HCombobox>
</template>

<script setup lang="ts">
import { INSTRUMENTS, writtenKey } from '@chord-scale-maker/engine'
import { Combobox as HCombobox, ComboboxInput as HComboboxInput, ComboboxOption as HComboboxOption, ComboboxOptions as HComboboxOptions } from '@headlessui/vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import { INSTRUMENT_GROUPS, instrumentOption } from '~/utils/instrumentChoices'
import { keyName, matchSpan, suggestTunes, TUNES } from '~/utils/library'
import { libraryPath, songPath } from '~/utils/site'

/** the home page's search: tunes as you type, each in its key written for this browser's instrument (issue #243) */
const SHOWN = 6
/** the last option's value, when there are more than shown: every match, on the library page */
const ALL = '#all'

const query = ref('')
const picked = ref<string | null>(null)
const found = computed(() => suggestTunes(TUNES, query.value, SHOWN))
const { instrument } = usePreferences()
const transposing = computed(() => INSTRUMENTS[instrument.value].trans !== 'C')
const written = (key: string): string => writtenKey(key, INSTRUMENTS[instrument.value])

/** the title around its match: [before, match, after] */
function titleParts(title: string): string[] {
  const span = matchSpan(title, query.value)
  return span ? [title.slice(0, span[0]), title.slice(...span), title.slice(span[1])] : [title]
}

function go(value: string | null): void {
  if (value) void navigateTo(value === ALL ? libraryPath(query.value) : songPath(value))
}

// "/" anywhere but a text field goes to the search
const input = ref<{ $el: HTMLInputElement } | null>(null)
function onKey(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, select, [contenteditable]')) return
  e.preventDefault()
  input.value?.$el.focus()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
