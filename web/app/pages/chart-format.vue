<template>
  <article class="max-w-4xl space-y-12">
    <header class="space-y-3">
      <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">Reference</p>
      <UiHeading>Chart format</UiHeading>
      <UiText>
        Every chart is plain text, always in concert pitch. In the editor, <strong class="font-semibold text-zinc-950 dark:text-white">⋯ → Show source</strong>
        opens it: the same chart as the bars, and you can edit either. This page lists every line the app reads, and what it says when it
        can't read one.
      </UiText>
      <nav aria-label="On this page" class="pt-2">
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm/6">
          <li v-for="s in SECTIONS" :key="s.id"><a :href="`#${s.id}`" :class="LINK">{{ s.title }}</a></li>
        </ul>
      </nav>
    </header>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="example">
      <UiSubheading id="example">An example</UiSubheading>
      <UiText>
        The lines before the first <UiCode>section:</UiCode> are the header, about the tune. Each <UiCode>section:</UiCode> line opens a
        section: its own fields straight under it, then one row per chord, its bar counted from 1 in the section, until the next
        <UiCode>section:</UiCode>.
      </UiText>
      <pre data-example class="overflow-x-auto rounded-lg bg-zinc-950/2.5 p-4 font-mono text-sm/6 text-zinc-950 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:text-white dark:ring-white/10"><code>{{ EXAMPLE }}</code></pre>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>Bars 1 and 3 of A1 have two chords each: two rows with the same bar number. A chord lasts until the next bar number; the section's last chord lasts to its end.</li>
        <li>Most rows leave the scale off, so the analysis chooses it. <UiCode>C Dorian</UiCode> on bar 1 is written in, so it plays whatever the level.</li>
        <li><UiCode>V7/ii</UiCode> in the fourth cell tells the analysis what <UiCode>A7</UiCode> does; it still chooses the scale.</li>
        <li>A2 repeats A1. B holds its last chord through bar 8, so it says <UiCode>bars: 8</UiCode>, and changes key at bar 5.</li>
      </ul>
    </section>

    <section v-for="group in GROUPS" :key="group.id" class="scroll-mt-6 space-y-4" :aria-labelledby="group.id">
      <UiSubheading :id="group.id">{{ group.title }}</UiSubheading>
      <UiText>{{ group.intro }}</UiText>
      <UiTable dense grid :class="PRINT_TABLE">
        <UiTableHead>
          <UiTableRow><UiTableHeader>Line</UiTableHeader><UiTableHeader>What it does</UiTableHeader></UiTableRow>
        </UiTableHead>
        <UiTableBody>
          <UiTableRow v-for="f in group.fields" :id="f.id" :key="f.id" class="scroll-mt-6" data-field>
            <UiTableCell class="align-top font-mono whitespace-nowrap">{{ f.line }}</UiTableCell>
            <UiTableCell class="min-w-80 whitespace-normal">
              <template v-for="(p, i) in parts(f.text)" :key="i"><UiCode v-if="p.code">{{ p.text }}</UiCode><template v-else>{{ p.text }}</template></template>
              <template v-if="f.link"> (<UiTextLink :href="f.link.href">{{ f.link.label }}</UiTextLink>)</template>
            </UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="chords">
      <UiSubheading id="chords">Chords and scales</UiSubheading>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>
          Chords are written the way you'd write them on a napkin: <template v-for="(c, i) in CHORDS" :key="c"><UiCode>{{ c }}</UiCode>{{ i === CHORDS.length - 1 ? '.' : ', ' }}</template>
          Minor chords are shown with an en dash (<UiCode>C–7</UiCode>). <UiTextLink href="/chords">Chords</UiTextLink> lists every quality.
        </li>
        <li><UiCode>N.C.</UiCode> (no chord) is a rest: it's drawn on the Changes sheet, with no scale and no staff on the Scales sheet.</li>
        <li>A scale is its root and its name: <UiCode>Bb Dorian</UiCode>, <UiCode>D Half-Whole</UiCode>, <UiCode>G Altered</UiCode>. <UiTextLink href="/scales">Scales</UiTextLink> lists every one.</li>
        <li>
          A function is a Roman numeral in the row's key area, or in another before a colon: <UiCode>V7/ii</UiCode>, <UiCode>subV7</UiCode>,
          <UiCode>D: V7/ii</UiCode>. <UiTextLink href="/functions#writing">Functions and rules</UiTextLink> has the whole pattern and the scale each gets.
        </li>
        <li>A chord the app doesn't recognize comes up amber; give it a scale and it draws (<DecisionLink id="scale.unknown">until then</DecisionLink>).</li>
      </ul>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="errors">
      <UiSubheading id="errors">When a line can't be read</UiSubheading>
      <UiText>
        Anything the app can't make sense of is listed under the source, with its line number, and the rest of the chart still plays. The
        messages, each with a line that gets it:
      </UiText>
      <UiTable dense grid :class="PRINT_TABLE">
        <UiTableHead>
          <UiTableRow><UiTableHeader>You wrote</UiTableHeader><UiTableHeader>It says</UiTableHeader></UiTableRow>
        </UiTableHead>
        <UiTableBody>
          <UiTableRow v-for="e in ERRORS" :key="e.message">
            <UiTableCell class="align-top font-mono whitespace-pre">{{ e.shown }}</UiTableCell>
            <UiTableCell class="min-w-64 whitespace-normal" data-error>{{ e.message }}</UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
      <UiText>
        A chart can be at most {{ LIMITS.maxChars.toLocaleString('en') }} characters and {{ LIMITS.maxRows }} rows
        ({{ LIMITS.maxExpandedRows.toLocaleString('en') }} once <UiCode>copy:</UiCode> is played out), a cell {{ LIMITS.maxCell }} characters and a
        header field or comment {{ LIMITS.maxMeta }}. Past those it doesn't load.
      </UiText>
    </section>
  </article>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta } from '~/utils/site'
import { decisionOf, LIMITS, parseChart, sectionLayout } from '@chord-scale-maker/engine'

/** the chart format's reference (docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md §9 Phase 3); README "Charts" is its source */
type Field = Readonly<{ id: string; line: string; text: string; link?: Readonly<{ href: string; label: string }> }>
type Group = Readonly<{ id: string; title: string; intro: string; fields: readonly Field[] }>

const LINK = 'text-zinc-950 underline decoration-zinc-950/50 hover:decoration-zinc-950 dark:text-white dark:decoration-white/50 dark:hover:decoration-white'
const PRINT_TABLE = 'print:[&_td]:border print:[&_td]:border-zinc-400 print:[&_th]:border print:[&_th]:border-zinc-400 print:[&_td]:min-w-0 print:[&_td]:whitespace-normal'

const EXAMPLE = `title: Autumn Leaves
composer: Joseph Kosma
style: Medium Swing
key: Gm
form: AABC, 32 bars
aka: Les Feuilles mortes

section: A1
# bar | chord | scale | function
1 | Cm7 | C Dorian
1 | F7
2 | BbMaj7
3 | EbMaj7
3 | A7 | | V7/ii
4 | D7

section: A2
copy: A1

section: B
bars: 8
@key 5 Bb
1 | Am7b5
2 | D7
3 | Gm6  # held two bars
5 | Cm7
6 | F7
7 | BbMaj7`

/** `code` in a field's text, as UiCode */
const parts = (text: string): { text: string; code: boolean }[] => text.split('`').map((t, i) => ({ text: t, code: i % 2 === 1 })).filter((p) => p.text)

const GROUPS: readonly Group[] = [
  {
    id: 'header',
    title: 'The header',
    intro: 'Fields about the tune, one a line, before the first section. All are optional in your own charts.',
    fields: [
      { id: 'field-title', line: 'title:', text: 'The heading on every sheet.' },
      { id: 'field-subtitle', line: 'subtitle:', text: 'A second line under the title, in the style’s place.' },
      { id: 'field-composer', line: 'composer:', text: 'Who wrote it, in the line under the heading; a library tune links to its composer’s page.' },
      { id: 'field-style', line: 'style:', text: 'The feel: `Ballad`, `Medium Swing`, `Latin`. The click takes its tempo from it.' },
      { id: 'field-key', line: 'key:', text: 'The tune’s key (`Eb`, `Fm`, `Bb minor`): the analysis starts from it.' },
      { id: 'field-form', line: 'form:', text: 'The form: `AABA, 32 bars`. Intros and codas don’t count.' },
      { id: 'field-time', line: 'time:', text: 'The meter: `2/4`, `3/4`, `4/4` (without it), `5/4`, `6/4` or `7/4`. The Changes sheet writes its slashes and guide tones in it.' },
      { id: 'field-context', line: 'context:', text: 'How the analysis reads the chart: `functional` (cadences and key areas, the usual), `modal` (each chord its own mode) or `blues`. Without it the analysis decides; Read as, in the heading, sets it.', link: { href: decisionOf('scale.blues').href, label: 'a blues' } },
      { id: 'field-kind', line: 'kind:', text: '`tune` (without it), `form` (a progression with no composer: F Blues, Rhythm Changes) or `exercise`.' },
      { id: 'field-aka', line: 'aka:', text: 'The tune’s other titles, a `;` between them. The library search finds them too.' },
      { id: 'field-version', line: 'version:', text: 'Which version of the tune this chart is, when there are several (`version: Jazz Mind Accelerator`). Without it, the tune’s main chart.' },
      { id: 'field-recording', line: 'recording:', text: 'A notable recording: artist; album; label; year (the label and year may be empty), shown on the song page.' },
      { id: 'field-youtube', line: 'youtube:', text: 'The recording’s 11-character YouTube video ID, with `(link only)` after it if it won’t play embedded. Only with `recording:`.' },
      { id: 'field-source', line: 'source:', text: 'Where the chart came from. Kept with the chart, not shown.' },
      { id: 'field-contributor', line: 'contributor:', text: 'Who sent the chart for the library: “Chart contributed by …” on its song page.' },
      { id: 'field-minor', line: 'minor:', text: 'Reserved: read and ignored.' },
    ],
  },
  {
    id: 'sections',
    title: 'Sections',
    intro: 'A section’s fields go straight under its section: line, before its rows. Each lasts to the section’s end.',
    fields: [
      { id: 'field-section', line: 'section: A1', text: 'Opens a section. Its name has no spaces, and each name appears once.' },
      { id: 'field-section-key', line: 'key: D', text: 'The section’s key area, where the analysis would get it wrong. Afterwards the analysis finds the key again.' },
      { id: 'field-section-time', line: 'time: 3/4', text: 'The section’s meter.' },
      { id: 'field-bars', line: 'bars: 8', text: 'The section’s length, when its last chord is held past its last written bar. Without it, the section ends with its last row’s bar.' },
      { id: 'field-copy', line: 'copy: A1', text: 'Repeats a section above it: its rows, alternates, key, meter and length, unless this one sets its own `key:` or `time:`. It has no rows of its own, but may have its own endings and marks.' },
      { id: 'field-outside', line: 'outside: yes', text: 'The section is outside the form, like an intro or a coda.' },
      { id: 'field-outside-names', line: 'section: Intro', text: '`Intro`, `Coda`, `Tag` and `Ending` (and `Tag2`) are outside the form by name: they print where they stand, but the turnaround goes back to the form’s bar 1.' },
      { id: 'field-section-context', line: 'context: modal', text: 'A section’s context. Read and checked, but the analysis keeps the chart’s for now.' },
    ],
  },
  {
    id: 'rows',
    title: 'Rows',
    intro: 'One row per chord, cells split by |, in the section’s bar numbering.',
    fields: [
      { id: 'field-row', line: '1 | Cm7', text: 'A chord on bar 1. Two chords in a bar are two rows with the same bar number.' },
      { id: 'field-row-scale', line: '1 | Cm7 | C Dorian', text: 'A scale written in plays at every level, over the analysis. Left off, the analysis chooses it, at the sheet’s level.', link: { href: decisionOf('scale.level').href, label: 'levels' } },
      { id: 'field-row-function', line: '5 | A7 | | V7/ii', text: 'The chord’s function, after the scale cell (empty here). The analysis takes it as given, and still chooses the scale.', link: { href: '/functions#writing', label: 'writing a function' } },
      { id: 'field-alt', line: 'alt 8 | Abm7', text: 'An alternate row: the chords that bar plays in the alternate changes, with the same scale and function cells. Bars with no `alt` rows are shared. Rows and alternate rows go in bar order.', link: { href: '/help#alternates', label: 'alternate changes' } },
      { id: 'field-comment', line: '# a note', text: 'A line starting with `#` is a note to yourself. A row can end in one too, after a space: `6 | D7  # V7 of G minor`.' },
    ],
  },
  {
    id: 'directives',
    title: 'Changes inside a section',
    intro: 'Lines starting with @, among a section’s rows, each at one of its bars.',
    fields: [
      { id: 'field-at-key', line: '@key 5 D', text: 'A key change from bar 5 to the section’s end.' },
      { id: 'field-at-time', line: '@time 11 2/4', text: 'A meter change from bar 11 to the section’s end. Follow it with `@time 12 4/4` for a single 2/4 bar; the bar menu’s Bar in 2/4 … 7/4 writes both.' },
      { id: 'field-ending', line: '@ending 1 7 8', text: 'A 1st or 2nd ending over bars 7 to 8 (the last bar may be left off for one bar). Write the endings as bars in turn: 7–8, then 9–10. The Changes sheet draws the repeat.' },
      { id: 'field-segno', line: '@segno 1', text: 'A segno (𝄋) over bar 1. `@coda 9` puts a coda (⊕) over bar 9.' },
      { id: 'field-nav', line: '@nav 16 D.S. al Coda', text: 'An instruction over bar 16: `D.S. al Coda`, `D.C. al Fine`, `To Coda`, `Fine`.' },
      { id: 'field-at-context', line: '@context 9 modal', text: 'A context from bar 9 to the section’s end. Read and checked, not yet used.' },
    ],
  },
]

const SECTIONS = [
  { id: 'example', title: 'An example' },
  ...GROUPS.map((g) => ({ id: g.id, title: g.title })),
  { id: 'chords', title: 'Chords and scales' },
  { id: 'errors', title: 'Errors' },
]

const CHORDS = ['Cm7', 'C-7', 'Cmi7', 'Am7b5', 'D7#5', 'G7#9b13', 'EbMaj7', 'C9', 'Csus', 'C7sus4b9', 'D7/F#', 'Cm6/Eb']

/** a chart that gets each message, the line to show for it (the rest is context) */
const BAD: readonly Readonly<{ chart: string; shown?: string }>[] = [
  { chart: '1 | Cm7' },
  { chart: 'A | 1 | Cm7' },
  { chart: 'section: A\n1 | Cm7 | C Dorian | ii7 | ?', shown: '1 | Cm7 | C Dorian | ii7 | ?' },
  { chart: 'section: A\nsection: A', shown: 'section: A  (twice)' },
  { chart: 'section: A B' },
  { chart: 'section: A\n1 | Cm7\nkey: F', shown: 'key: F  (after a row)' },
  { chart: 'section: A\ncomposer: Monk', shown: 'composer: Monk  (in a section)' },
  { chart: 'copy: A' },
  { chart: 'section: A\ncopy: B', shown: 'copy: B  (no section B above)' },
  { chart: 'section: A\n1 | Cm7\nsection: B\ncopy: A\n1 | F7', shown: '1 | F7  (under copy: A)' },
  { chart: 'section: A\nbars: 2\n4 | Cm7', shown: 'bars: 2  (its last row on bar 4)' },
  { chart: 'section: A\nbars: 0', shown: 'bars: 0' },
  { chart: 'section: A\n1 | Cm7\nalt 3 | Dm7', shown: 'alt 3 | Dm7  (a section of 1 bar)' },
  { chart: 'section: A\n2 | Cm7\nalt 2 | Dm7\n1 | F7', shown: '1 | F7  (after bar 2)' },
  { chart: 'section: A\noutside: maybe', shown: 'outside: maybe' },
  { chart: 'section: A\nkey: H', shown: 'key: H  (in a section)' },
  { chart: 'time: 9/8' },
  { chart: 'section: A\n@time 3 9/8', shown: '@time 3 9/8' },
  { chart: 'kind: song' },
  { chart: 'context: jazz' },
  { chart: 'section: A\n@key 5 H', shown: '@key 5 H' },
  { chart: 'section: A\n@ending 3 7', shown: '@ending 3 7' },
  { chart: 'section: A\n@ending 1 8 7', shown: '@ending 1 8 7' },
  { chart: 'section: A\n@segno', shown: '@segno' },
  { chart: 'section: A\n@nav D.S.', shown: '@nav D.S.' },
  { chart: 'section: A\n@context 9 jazz', shown: '@context 9 jazz' },
  { chart: '@segno 1' },
  { chart: 'section: A\n@fine 8', shown: '@fine 8' },
  { chart: 'section: A\n@copy A', shown: '@copy A' },
  { chart: 'recording: John Coltrane' },
  { chart: 'recording: John Coltrane; Blue Train; Blue Note; 58' },
  { chart: 'recording: John Coltrane; Blue Train\nyoutube: abc', shown: 'youtube: abc' },
  { chart: 'youtube: AbCdEfGhIjK' },
]
/** each bad chart's first message, from the parser itself, so this list can't drift from it */
const ERRORS = BAD.map(({ chart, shown }) => {
  const parsed = parseChart(chart)
  const [first] = [...parsed.diagnostics, ...sectionLayout(parsed.value).diagnostics]
  return { shown: shown ?? chart, message: first?.message ?? '' }
})

useSeoMeta(seoMeta(PAGE_HEAD['chart-format']))
</script>
