<template>
  <!-- a numeral or scale on the Changes sheet; a click or tap opens why the analysis chose it, with the rule behind it.
       A dotted underline in the accent colour says it opens (not printed) -->
  <HPopover class="relative inline-block max-w-full">
    <HPopoverButton
      :class="wrap ? 'whitespace-normal' : 'truncate'"
      class="block max-w-full cursor-pointer rounded-sm text-left underline decoration-note-500/60 decoration-dotted underline-offset-[3px] hover:bg-note-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-note-500 dark:decoration-note-300/60 dark:hover:bg-white/5 print:no-underline"
      @click="place"
    >
      <slot />
    </HPopoverButton>
    <HPopoverPanel
      role="dialog"
      :style="{ left: `${shift}px` }"
      :aria-label="`Why: ${chord}`"
      class="absolute top-full left-0 z-20 mt-2 w-72 rounded-lg max-sm:w-[calc(100vw-2rem)] bg-white p-3 text-left text-sm/6 font-normal text-zinc-700 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-white/10 print:hidden"
    >
      <span class="block">
        {{ reason }}<template v-if="rule">
          · rule <template v-for="(id, k) in parts" :key="id"><template v-if="k">+</template><NuxtLink :to="`/functions#rule-${id}`" class="underline decoration-zinc-950/30 hover:decoration-zinc-950 dark:decoration-white/30 dark:hover:decoration-white">{{ id }}</NuxtLink></template><template v-if="fallback">, a guess — an @key or a function would settle it</template>
        </template>
      </span>
      <span class="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{{ keyFrom === 'found' ? '' : '* ' }}in {{ heardIn }}</span>
      <div v-if="context" class="mt-2 space-y-2 border-t border-zinc-950/5 pt-2 dark:border-white/5" @vue:mounted="prepare">
        <UiButton plain data-copy :data-ready="ready" class="text-sm!" @click="copy">Report issue</UiButton>
        <template v-if="state === 'copied' || state === 'manual'">
          <p v-if="state === 'copied'" class="text-xs text-zinc-500 dark:text-zinc-400" role="status">Copied.</p>
          <template v-else>
            <p class="text-xs text-zinc-500 dark:text-zinc-400" role="status">Copy it from here:</p>
            <textarea readonly rows="6" class="w-full rounded-md border border-zinc-950/10 bg-transparent p-2 font-mono text-xs dark:border-white/10" :value="text" @focus="($event.target as HTMLTextAreaElement).select()" />
          </template>
          <div class="flex flex-col items-start gap-1">
            <UiButton plain data-contact class="text-sm!" @click="toContact">Send it with the contact form</UiButton>
            <UiTextLink :href="github.url" external>Open a GitHub issue</UiTextLink>
            <p v-if="!github.full" class="text-xs text-zinc-500 dark:text-zinc-400">The link is too long to carry the details: paste them into the issue.</p>
          </div>
        </template>
      </div>
    </HPopoverPanel>
  </HPopover>
</template>

<script setup lang="ts">
import { Popover as HPopover, PopoverButton as HPopoverButton, PopoverPanel as HPopoverPanel } from '@headlessui/vue'
import { type ChangesChord, ruleParts } from '@chord-scale-maker/engine'
import { panelShift } from '~/utils/notePlacement'
import { ISSUE_CONTEXT, ISSUE_TEXT_KEY, issueText, issueTitle, issueUrl } from '~/utils/issueReport'

/**
 * why the analysis gave a chord its function and scale (engine/src/changes.ts reason, rule, heardIn, keyFrom), opened by a
 * click or tap; Escape or a click outside closes it. A key the author set, by an @key or the function's own key, is
 * starred, as in the grid's Function dropdown. The rule id links to its row on /functions. chord is the symbol as
 * drawn for the part (written), concert the chart's own.
 */
const props = withDefaults(
  defineProps<{ reason: string; heardIn: string; keyFrom: ChangesChord['keyFrom']; rule: string; fallback: boolean; chord: string; concert: string; numeral: string; scale: string | null; at: Readonly<{ section: string; bar: string }>; wrap?: boolean }>(),
  { wrap: false },
)
const shift = ref(0)
/**
 * on a click that opens the panel (keyboard activation clicks too): measure it, then move it so it stays on the
 * screen, on a phone and near the sheet's right edge (it opens at its numeral's left edge)
 */
async function place(e: MouseEvent): Promise<void> {
  const anchor = (e.currentTarget as HTMLElement | null)?.parentElement // read before the await: currentTarget is cleared after dispatch
  shift.value = 0
  await new Promise((r) => requestAnimationFrame(r)) // the panel renders a tick or two after the click
  const panel = anchor?.querySelector<HTMLElement>('[role=dialog]')
  if (panel && anchor) shift.value = panelShift(anchor.getBoundingClientRect().left, panel.offsetWidth, document.documentElement.clientWidth)
}
const parts = computed(() => ruleParts(props.rule))

const context = inject(ISSUE_CONTEXT, null)
const state = ref<'idle' | 'copied' | 'manual'>('idle')
const text = ref('')
const title = ref('')
/** the report has its share link: Copy can write it within the click (Safari allows the clipboard only there) */
const ready = ref(false)
const github = computed(() => issueUrl(title.value, text.value))
const NO_LINK = "(this browser could not make one: paste the chart's text here)"
let opening = 0

/** on opening: a fresh report, its share link made now, so the Copy click has nothing to wait for */
async function prepare(): Promise<void> {
  if (!context) return
  const n = ++opening
  state.value = 'idle'
  ready.value = false
  const library = context.library()
  const fields = { title: context.title(), ...(library ? { library } : {}), at: props.at, part: context.part(), chord: props.chord, concert: props.concert, numeral: props.numeral, heardIn: props.heardIn, scale: props.scale, rule: props.rule, reason: props.reason }
  title.value = issueTitle({ ...fields, link: null })
  if (library) {
    // a library chart as published: its slug and bar find it, no share link to wait for
    text.value = issueText({ ...fields, link: null })
    ready.value = true
    return
  }
  text.value = issueText({ ...fields, link: '(being made…)' })
  let link: string | null
  try {
    link = await context.shareUrl()
  } catch {
    link = null
  }
  if (n !== opening) return
  text.value = issueText({ ...fields, link: link ?? NO_LINK })
  ready.value = link !== null
}

/** the report on the clipboard, written within the click; shown to copy by hand when it isn't ready or the clipboard refuses */
function copy(): void {
  if (!ready.value || !navigator.clipboard) {
    state.value = 'manual'
    return
  }
  try {
    navigator.clipboard.writeText(text.value).then(
      () => (state.value = 'copied'),
      () => (state.value = 'manual'),
    )
  } catch {
    state.value = 'manual'
  }
}

function toContact(): void {
  try {
    sessionStorage.setItem(ISSUE_TEXT_KEY, text.value)
  } catch {
    // storage blocked: the form opens empty, and the text is still on the clipboard or in the box
  }
  navigateTo('/contact')
}
</script>
