<template>
  <article class="max-w-4xl space-y-12">
    <header class="space-y-3">
      <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">Reference</p>
      <UiHeading>Functions and rules</UiHeading>
      <UiText>
        How to write a chord's function in a chart, the scale every function gets in any key, and the rules the app
        follows to choose a scale. If you think a scale is wrong, the last section says how to tell me.
      </UiText>
      <nav aria-label="On this page" class="pt-2">
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm/6">
          <li v-for="s in SECTIONS" :key="s.id"><a :href="`#${s.id}`" :class="LINK">{{ s.title }}</a></li>
        </ul>
      </nav>
    </header>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="writing">
      <UiSubheading id="writing">Writing a function</UiSubheading>
      <UiText>
        A chart row may end with the chord's function, after the scale: <UiCode>A | 5 | A7 | | V7/ii</UiCode>. The
        function is read as:
      </UiText>
      <pre class="overflow-x-auto rounded-lg bg-zinc-950/2.5 p-4 font-mono text-sm/6 text-zinc-950 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:text-white dark:ring-white/10"><code>{{ GRAMMAR }}</code></pre>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>The numeral counts from the row's key area, or from the key before a colon: <UiCode>Eb: V7/ii</UiCode>.</li>
        <li>
          Case follows the chord family: upper case for major, dominant and sus; lower case for minor, half-diminished
          and diminished. The editor corrects the case, but rejects a major quality on a lower-case numeral.
        </li>
        <li><UiCode>sub</UiCode> (a tritone substitute) goes only on a dominant: <UiCode>subV7</UiCode>, <UiCode>subV7/ii</UiCode>.</li>
        <li>
          After the slash comes the chord it leads to, as a degree of the key: <UiCode>V7/ii</UiCode>,
          <UiCode>iiø7/vi</UiCode>, <UiCode>♯iv°7/V</UiCode>.
        </li>
        <li>Degrees count from the tonic as in a major key, in minor keys too: <UiCode>♭III</UiCode> in C minor is E♭.</li>
        <li><UiCode>(V7/ii)</UiCode>: a dominant that doesn’t resolve as expected; the scale is the same. The sheet prints the parentheses.</li>
        <li>
          Berklee spellings read too: <UiCode>II-7</UiCode>, <UiCode>VII-7(♭5)</UiCode>, <UiCode>V7(sus4)</UiCode>,
          <UiCode>SubV7/ii</UiCode>, <UiCode>I∆7</UiCode> (Δ or ∆), <UiCode>B♭: V7/ii</UiCode>.
        </li>
      </ul>

      <UiSubheading :level="3" class="pt-2">Qualities</UiSubheading>
      <UiTable dense grid :class="PRINT_TABLE">
        <UiTableHead>
          <UiTableRow><UiTableHeader>Family</UiTableHeader><UiTableHeader>Written on the sheet</UiTableHeader><UiTableHeader>Accepted spellings</UiTableHeader></UiTableRow>
        </UiTableHead>
        <UiTableBody>
          <UiTableRow v-for="s in SPELLINGS" :key="`${s.family}|${s.written}`">
            <UiTableCell>{{ FAMILY_NAMES[s.family] }}</UiTableCell>
            <UiTableCell><UiCode v-if="s.written">{{ s.written }}</UiCode><span v-else class="text-zinc-500 dark:text-zinc-400">nothing (a triad)</span></UiTableCell>
            <UiTableCell>
              <span class="flex flex-wrap gap-1">
                <template v-for="sp in s.spellings" :key="sp"><UiCode v-if="sp">{{ sp }}</UiCode><span v-else class="text-zinc-500 dark:text-zinc-400">nothing</span></template>
              </span>
            </UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>

      <UiSubheading :level="3" class="pt-2">When a function won't read</UiSubheading>
      <UiTable dense grid :class="PRINT_TABLE">
        <UiTableHead>
          <UiTableRow><UiTableHeader>Written</UiTableHeader><UiTableHeader>The editor says</UiTableHeader><UiTableHeader>Meaning</UiTableHeader></UiTableRow>
        </UiTableHead>
        <UiTableBody>
          <UiTableRow v-for="e in ERRORS" :key="e.example">
            <UiTableCell><UiCode>{{ e.example }}</UiCode></UiTableCell>
            <UiTableCell class="min-w-56 whitespace-normal" data-error>{{ e.message }}</UiTableCell>
            <UiTableCell class="min-w-56 whitespace-normal">{{ e.meaning }}</UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>

      <UiText>
        A function settles the numeral and the key the rules reason in. It doesn't change the chord: the chord symbol,
        its labels and the practice presets still read the chord as written. On a dominant the rules still choose the
        tensions from the key, so a function is usually better than picking the scale yourself: transpose the chart
        and the scale still fits.
      </UiText>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="table">
      <UiSubheading id="table">Functions and their scales</UiSubheading>
      <UiText>
        Each row is a one-chord chart run through the same analysis the sheets use: the chord the function puts in
        the key, the scale the rules give it, the rule that decided and why. Where the rules can only guess, the rule
        is marked (guess), and the note on the sheet says “{{ FALLBACK }}”. In a real chart the chords around a chord
        can settle what one chord on its own leaves open.
      </UiText>
      <div class="flex items-center gap-3">
        <span class="text-base/6 font-medium text-zinc-950 sm:text-sm/6 dark:text-white" aria-hidden="true">Key</span>
        <div class="w-48 print:[&_svg]:hidden">
          <UiListbox v-model="keyCode" aria-label="Key">
            <template #selected="{ value }">{{ functionsKeyLabel(value) }}</template>
            <UiListboxOption v-for="k in FUNCTIONS_KEYS" :key="k" :value="k"><UiListboxLabel>{{ functionsKeyLabel(k) }}</UiListboxLabel></UiListboxOption>
          </UiListbox>
        </div>
      </div>

      <nav ref="groupNav" aria-label="Groups" class="sticky top-0 z-10 -mx-2 flex flex-wrap gap-x-4 bg-white/90 px-2 py-2 text-sm/6 backdrop-blur dark:bg-zinc-900/90 print:hidden">
        <a
          v-for="g in FUNCTION_GROUPS"
          :key="g.id"
          :href="`#group-${g.id}`"
          :aria-current="active === g.id ? 'true' : undefined"
          :class="[LINK, active === g.id && 'font-semibold']"
        >{{ g.title }}</a>
      </nav>

      <div v-for="g in FUNCTION_GROUPS" :key="g.id" class="space-y-2">
        <UiSubheading :id="`group-${g.id}`" :level="3" class="scroll-mt-20 pt-2 print:break-after-avoid">{{ g.title }}</UiSubheading>
        <UiTable dense grid :class="PRINT_TABLE">
          <UiTableHead>
            <UiTableRow><UiTableHeader>Function</UiTableHeader><UiTableHeader>Chord</UiTableHeader><UiTableHeader>Scale</UiTableHeader><UiTableHeader>Rule</UiTableHeader><UiTableHeader>Why</UiTableHeader></UiTableRow>
          </UiTableHead>
          <UiTableBody>
            <UiTableRow v-for="r in groupRows(g.id)" :key="r.fn">
              <UiTableCell class="font-medium">{{ r.fn }}</UiTableCell>
              <UiTableCell>{{ glyphs(r.chord) }}</UiTableCell>
              <UiTableCell>{{ r.scale ? glyphs(r.scale) : '—' }}</UiTableCell>
              <UiTableCell>
                <template v-for="(id, k) in ruleParts(r.rule)" :key="id"><template v-if="k">+</template><a :href="`#rule-${id}`" :class="LINK">{{ id }}</a></template><span v-if="r.fallback" class="text-zinc-500 dark:text-zinc-400"> (guess)</span>
              </UiTableCell>
              <UiTableCell class="min-w-64 whitespace-normal text-zinc-600 dark:text-zinc-400">{{ proseGlyphs(r.reason) }}</UiTableCell>
            </UiTableRow>
          </UiTableBody>
        </UiTable>
      </div>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="rules">
      <UiSubheading id="rules">How the engine chooses a scale</UiSubheading>
      <UiText>
        Each chord family has its own rules, tried in the order listed below; the first that applies decides. They are
        grouped here by what they look at, from the chord symbol alone to the chords around it.
      </UiText>

      <div v-for="t in TIER_LIST" :key="t.tier" class="space-y-2">
        <UiSubheading :level="3" class="pt-2 print:break-after-avoid">{{ t.title }}</UiSubheading>
        <UiTable dense grid :class="PRINT_TABLE">
          <UiTableHead>
            <UiTableRow><UiTableHeader>Rule</UiTableHeader><UiTableHeader>Family</UiTableHeader><UiTableHeader>Scale</UiTableHeader><UiTableHeader>Looks at</UiTableHeader><UiTableHeader>What it does</UiTableHeader></UiTableRow>
          </UiTableHead>
          <UiTableBody>
            <UiTableRow v-for="r in t.rules" :id="`rule-${r.id}`" :key="r.id" class="scroll-mt-14 target:bg-note-50 dark:target:bg-note-950">
              <UiTableCell class="font-medium">{{ r.id }}</UiTableCell>
              <UiTableCell>{{ FAMILY_NAMES[r.family] }}</UiTableCell>
              <UiTableCell class="min-w-40 whitespace-normal">{{ proseGlyphs(r.scale) }}</UiTableCell>
              <UiTableCell class="min-w-48 whitespace-normal text-zinc-600 dark:text-zinc-400">{{ proseGlyphs(r.looksAt) }}</UiTableCell>
              <UiTableCell class="min-w-64 whitespace-normal text-zinc-600 dark:text-zinc-400">
                {{ proseGlyphs(r.summary) }}
                <span v-if="r.guess" class="mt-1 block text-zinc-500 italic dark:text-zinc-500">{{ r.guess === 'always' ? 'Always a guess.' : `A guess when: ${proseGlyphs(r.guess)}.` }}</span>
              </UiTableCell>
            </UiTableRow>
          </UiTableBody>
        </UiTable>
      </div>

      <UiSubheading :level="3" class="pt-2">The order each family tries</UiSubheading>
      <ul class="space-y-1 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li v-for="f in TRY_ORDER" :key="f.family">
          <span class="font-semibold text-zinc-950 dark:text-white">{{ FAMILY_NAMES[f.family] }}:</span>
          {{ ' ' }}<template v-for="(id, k) in f.ids" :key="id"><template v-if="k"> → </template><a :href="`#rule-${id}`" :class="LINK">{{ id }}</a></template>
        </li>
      </ul>

      <UiSubheading :level="3" class="pt-2">Dominants</UiSubheading>
      <UiText>
        A dominant's scale is named by three tension slots: the 9th (9, ♭9, or ♭9 and ♯9 together), the 11th (11 or
        ♯11) and the 13th (13 or ♭13). A rule that derives them (D4, D5, D8) reads each slot from the key's own
        scale: major in a major key, natural minor in a minor key, harmonic minor for the minor key's own V7. It takes
        the altered form only when the key holds it and not the natural one. Tensions written in the symbol
        (<UiCode>G7b9</UiCode>, <UiCode>7#11</UiCode>, <UiCode>alt</UiCode>) fill their slots over the rule's, and the
        rule id says so: <UiCode>G7b9</UiCode> going to C in C major is <a href="#rule-D1" :class="LINK">D1</a>+<a href="#rule-D4" :class="LINK">D4</a>,
        G Half-Whole Diminished. The slots name the scale:
      </UiText>
      <UiTable dense grid :class="PRINT_TABLE">
        <UiTableHead>
          <UiTableRow><UiTableHeader>9th</UiTableHeader><UiTableHeader>11th</UiTableHeader><UiTableHeader>13th</UiTableHeader><UiTableHeader>Scale</UiTableHeader></UiTableRow>
        </UiTableHead>
        <UiTableBody>
          <UiTableRow v-for="d in DOMINANTS" :key="`${d.n9}${d.n11}${d.n13}`">
            <UiTableCell>{{ slotText(d.n9) }}</UiTableCell>
            <UiTableCell>{{ slotText(d.n11) }}</UiTableCell>
            <UiTableCell>{{ slotText(d.n13) }}</UiTableCell>
            <UiTableCell>{{ glyphs(d.scale) }}</UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="report">
      <UiSubheading id="report">Reporting a disagreement</UiSubheading>
      <UiText>The rules are a starting point, and a tune can know better. If a scale looks wrong to you, send:</UiText>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>the chart row: the chord, its function and its key area;</li>
        <li>the scale shown;</li>
        <li>the rule id;</li>
        <li>the scale you expected, and why: a melody note, a recording, a book.</li>
      </ul>
      <UiText>
        On the Changes sheet, click a chord's numeral or scale to see why it was chosen; <strong class="font-semibold text-zinc-950 dark:text-white">Report issue</strong>
        in that note copies exactly this: the chord's bar, and a link to the chart unless it's a library chart you haven't
        edited. Paste it into the
        <UiTextLink href="/contact">contact form</UiTextLink> or a
        <UiTextLink :href="`${ISSUE_REPO}/issues/new`" external>new GitHub issue</UiTextLink>, and fill in what you expected.
      </UiText>
    </section>
  </article>
</template>

<script setup lang="ts">
import {
  dominantScaleTable,
  FUNCTION_GROUPS,
  type FunctionGroup,
  functionsTable,
  glyphs,
  parseFunction,
  parseKey,
  proseGlyphs,
  type RuleInfo,
  ruleParts,
  RULES,
  spellings,
  TIERS,
} from '~~/engine'
import { FUNCTIONS_KEYS, functionsKeyFrom, functionsKeyLabel, keyedLocation } from '~/utils/functionsKey'
import { ISSUE_REPO } from '~/utils/issueReport'

/**
 * The reference page for functions and the analysis rules (docs/superpowers/specs/2026-10-10-functions-help-page-design.md):
 * prerendered in C major; the key picker recomputes the table with the engine, no fetch.
 */
const SECTIONS = [
  { id: 'writing', title: 'Writing a function' },
  { id: 'table', title: 'Functions and their scales' },
  { id: 'rules', title: 'How the engine chooses a scale' },
  { id: 'report', title: 'Reporting a disagreement' },
]
const LINK = 'text-zinc-950 underline decoration-zinc-950/50 hover:decoration-zinc-950 dark:text-white dark:decoration-white/50 dark:hover:decoration-white'
// printed, the tables keep their borders and wrap to the page instead of scrolling
const PRINT_TABLE = 'print:[&_td]:border print:[&_td]:border-zinc-400 print:[&_th]:border print:[&_th]:border-zinc-400 print:[&_td]:min-w-0 print:[&_td]:whitespace-normal'
const GRAMMAR = '[Key:] [(] [sub] [♭|♯] NUMERAL [quality] [/ [♭|♯] NUMERAL] [)]'
const FALLBACK = 'a guess — an @key or a function would settle it'

type Family = RuleInfo['family']
const FAMILY_NAMES: Readonly<Record<Family, string>> = { major: 'major', dominant: 'dominant', minor: 'minor', halfdim: 'half-diminished', dim: 'diminished', sus: 'sus' }
const FAMILY_ORDER: readonly Family[] = ['major', 'dominant', 'minor', 'halfdim', 'dim', 'sus']
const SPELLINGS = [...spellings()].sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family))

// the messages are the parser's own, never typed here; the meanings are this page's
const ERRORS = [
  { example: 'H: V7', meaning: 'The text before the colon has to be a key.' },
  { example: 'V7/x', meaning: 'It doesn’t follow the pattern above.' },
  { example: 'subii7', meaning: 'A tritone substitute is a dominant: subV7, subV7/ii.' },
  { example: 'iimaj7', meaning: 'A lower-case numeral is a minor-family chord; a major chord takes an upper-case one (IImaj7).' },
].map((e) => {
  const r = parseFunction(e.example)
  return { ...e, message: typeof r === 'string' ? r : '' }
})

const TIER_LIST = (Object.entries(TIERS) as [string, string][]).map(([tier, title]) => ({ tier, title, rules: RULES.filter((r) => String(r.tier) === tier) }))
const TRY_ORDER = FAMILY_ORDER.map((family) => ({ family, ids: RULES.filter((r) => r.family === family).map((r) => r.id) })).filter((f) => f.ids.length)
const DOMINANTS = dominantScaleTable()
const slotText = (slot: string): string => glyphs(slot === 'b9#9' ? 'b9 #9' : slot)

// the key: C while prerendering and hydrating (the HTML is C major); then the link's ?key=, or this browser's last choice
const route = useRoute()
const prefs = usePreferences()
const keyCode = ref(import.meta.client && !useNuxtApp().isHydrating ? functionsKeyFrom(route.query.key, null) : 'C')
const rows = computed(() => functionsTable(parseKey(keyCode.value) ?? parseKey('C')!))
const groupRows = (g: FunctionGroup) => rows.value.filter((r) => r.group === g)

/** the key in the link, so it can be shared (history directly: a router navigation would scroll back to the #anchor) */
function syncUrl(k: string): void {
  const next = keyedLocation(location.href, history.state, k)
  if (next) history.replaceState(next.state, '', next.url)
}
/** a ?key= that isn't the key shown (one that doesn't read) is rewritten; no ?key= at all stays out of the link */
const syncQuery = (): void => {
  if (route.query.key !== undefined && route.query.key !== keyCode.value) syncUrl(keyCode.value)
}

watch(keyCode, (k) => {
  prefs.functionsKey.value = k
  syncUrl(k)
})

// the link's ?key= reaches the route only after a prerendered page has hydrated (and changes on back and forward)
watch(
  () => route.query.key,
  (q) => {
    keyCode.value = functionsKeyFrom(q, keyCode.value)
    syncQuery()
  },
)

// the sub-navigation marks the group being read: the last whose heading has gone under the sticky row
const active = ref<FunctionGroup>(FUNCTION_GROUPS[0]?.id ?? 'diatonic')
const groupNav = useTemplateRef<HTMLElement>('groupNav')
let observer: IntersectionObserver | undefined
onMounted(() => {
  keyCode.value = functionsKeyFrom(route.query.key, prefs.functionsKey.value)
  syncQuery()
  // a prerendered page's router puts the arrival address back once it has hydrated, over anything written before
  onNuxtReady(() => {
    if (route.query.key !== undefined || keyCode.value !== 'C') syncUrl(keyCode.value)
  })
  const line = (groupNav.value?.offsetHeight ?? 40) + 48 // below the row (two lines on a phone), past where a #group link lands
  const update = () => {
    const passed = FUNCTION_GROUPS.filter((g) => (document.getElementById(`group-${g.id}`)?.getBoundingClientRect().top ?? Infinity) <= line)
    active.value = passed.at(-1)?.id ?? FUNCTION_GROUPS[0]?.id ?? 'diatonic'
  }
  observer = new IntersectionObserver(update, { rootMargin: `-${line}px 0px 0px 0px`, threshold: [0, 1] })
  for (const g of FUNCTION_GROUPS) {
    const h = document.getElementById(`group-${g.id}`)
    if (h) observer.observe(h)
  }
  update()
})
onBeforeUnmount(() => observer?.disconnect())

useHead({
  title: 'Functions and rules · Chord Scale Maker',
  meta: [{ name: 'description', content: 'How to write a chord’s function in a chart, the scale every function gets in any key, and the rules that choose it.' }],
})
</script>
