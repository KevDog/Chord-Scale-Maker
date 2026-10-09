<template>
  <article class="max-w-3xl space-y-12">
    <header class="space-y-3">
      <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">Help</p>
      <UiHeading>How it all works</UiHeading>
      <UiText>
        Nothing here is complicated, but a few things are tucked away. Here's the tour. If something's still unclear,
        <UiTextLink href="/contact">tell me</UiTextLink> and I'll fix the page (or the app).
      </UiText>
      <nav aria-label="On this page" class="pt-2">
        <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm/6">
          <li v-for="s in SECTIONS" :key="s.id"><UiTextLink :href="`#${s.id}`">{{ s.title }}</UiTextLink></li>
        </ul>
      </nav>
    </header>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="quick">
      <UiSubheading id="quick">The short version</UiSubheading>
      <ol class="list-decimal space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>Pick a tune from the <UiTextLink href="/">library</UiTextLink>.</li>
        <li>Choose your instrument under <strong class="font-semibold text-zinc-950 dark:text-white">Preview</strong>. The sheet is rewritten for it.</li>
        <li>Practise from the screen, hit <strong class="font-semibold text-zinc-950 dark:text-white">Focus</strong> to get rid of everything but the music, or print it.</li>
      </ol>
      <UiText>That's genuinely it. Everything below is for when you want more.</UiText>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="sheets">
      <UiSubheading id="sheets">The three sheets</UiSubheading>
      <UiText>
        <strong class="font-semibold text-zinc-950 dark:text-white">Scales</strong> is the main event: one staff per
        chord, with the scale that goes with it, in the order the tune runs. Each staff is labelled with where it is in
        the form, the chord and the scale.
      </UiText>
      <UiText>
        <strong class="font-semibold text-zinc-950 dark:text-white">Guide tones</strong> boils the tune down to the
        3rds and 7ths, the notes that tell you which chord you're on. It writes two lines on two staves, four bars to a
        system, and each line moves to the closest note it can, so you can hear how the harmony leans from one chord to
        the next. It's in 4/4 unless the chart says otherwise (<UiCode>time: 3/4</UiCode> for a waltz), and a chord lasts
        until the next bar number. Try singing or playing one line all the way through the tune; it's a great way to
        learn the changes.
      </UiText>
      <UiText>
        <strong class="font-semibold text-zinc-950 dark:text-white">Changes</strong> is the tune as a lead sheet without
        the melody: slashes, four bars a line, with each chord's Roman numeral and scale under it, and the key written
        in wherever it moves. It's the why behind the Scales sheet: <em>ii7 V7 Imaj7</em> in one key, then a
        <em>V7/ii</em> borrowing from the next. <strong class="font-semibold text-zinc-950 dark:text-white">Numerals</strong>
        and <strong class="font-semibold text-zinc-950 dark:text-white">Scales</strong> turn those rows on and off.
      </UiText>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="controls">
      <UiSubheading id="controls">The preview controls</UiSubheading>
      <dl class="space-y-4 text-base/6 sm:text-sm/6">
        <div>
          <dt class="font-semibold text-zinc-950 dark:text-white">Instrument</dt>
          <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
            Charts are always written in concert pitch, and the sheet is transposed for you: trumpet, clarinet, tenor
            and soprano in B♭, alto and bari in E♭, horn in F, and trombone, tuba and bass in bass clef. Piano, vibes,
            guitar and flute read concert. Your choice is remembered.
          </dd>
        </div>
        <div>
          <dt class="font-semibold text-zinc-950 dark:text-white">From root or From C</dt>
          <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
            <strong class="font-semibold">From root</strong> starts every scale on its own chord's root: the D Dorian on
            D, the G Mixolydian on G. <strong class="font-semibold">From C</strong> (or whatever note you pick in
            <strong class="font-semibold">Start on</strong>) starts every scale on the same note. That one's sneaky
            good: the staves line up, so you can see exactly which notes change from chord to chord and which stay put.
          </dd>
        </div>
        <div>
          <dt class="font-semibold text-zinc-950 dark:text-white">Intervals</dt>
          <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
            Labels each note against the chord's root (1, 9, ♭3, 11 and so on). Handy while you're learning what each
            note does. It starts on; switch it off if you don't need it (that's remembered too). It's on screen only,
            so printed sheets stay clean.
          </dd>
        </div>
        <div v-if="levelsOn">
          <dt class="font-semibold text-zinc-950 dark:text-white">Scale level</dt>
          <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
            How fancy the scales get, per chart. <strong class="font-semibold">Basic</strong> leans on pentatonics
            (five notes, hard to land on a wrong one), <strong class="font-semibold">Standard</strong> is the usual
            chord-scale for each chord, and <strong class="font-semibold">Advanced</strong> reaches for bebop,
            Lydian and altered colours. <strong class="font-semibold">Random</strong> deals a different inside scale
            to every chord, so you can't coast; hit <strong class="font-semibold">Shuffle</strong> for a new hand.
            It's above the chart grid, and it writes the scales into the chart, so they save, print and share with
            it. Scales you picked yourself stay put, and Standard puts everything else back.
          </dd>
        </div>
      </dl>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="practice">
      <UiSubheading id="practice">Practice: improvise with fewer notes</UiSubheading>
      <UiText>
        On the Scales sheet, the <strong class="font-semibold text-zinc-950 dark:text-white">Practice</strong> panel
        lets you pick a handful of notes from each scale. Those stay bold and the rest fade back, on screen and in
        print. Improvising with just the guide tones through a tune is harder (and more useful) than it sounds.
      </UiText>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>
          <strong class="font-semibold text-zinc-950 dark:text-white">Presets</strong> (in From root) work chord by chord: Chord tones,
          Guide tones (3rds and 7ths) and Tensions (everything else). They know an altered chord's ♭3 is really a ♯9, so
          they won't light it as a 3rd.
        </li>
        <li>
          <strong class="font-semibold text-zinc-950 dark:text-white">The boxes</strong> pick notes by interval: tick
          ♭3 and every minor 3rd lights up. They count from the chord's root, not the scale's first note, so with
          C minor pentatonic over B♭–7, B♭ is 1 and C is 2 (the 9th). The interval labels under the notes show the
          same numbers. In From C mode the boxes are pitches instead (tick E♭ and every E♭ lights
          up), which shows you where a note survives a chord change and where it doesn't.
        </li>
        <li>Tick or untick a box while a preset's on and you get your own mix, starting from what the preset showed.</li>
        <li><strong class="font-semibold text-zinc-950 dark:text-white">Clear</strong> turns it all off.</li>
        <li>Your picks are remembered for each library chart, in this browser, separately for From root and From C.</li>
      </ul>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="editing">
      <UiSubheading id="editing">Editing a chart</UiSubheading>
      <UiText>
        Every library chart opens in the editor, and you can change anything: a reharmonisation, a different scale
        choice, a bridge you play differently. The <strong class="font-semibold text-zinc-950 dark:text-white">Chart</strong>
        grid and the <strong class="font-semibold text-zinc-950 dark:text-white">Text</strong> box are two views of the
        same chart; edit either and the other (and the preview) keeps up. The Text box is tucked away until you press
        <strong class="font-semibold text-zinc-950 dark:text-white">Show text</strong>, and it stays out once you do.
      </UiText>

      <UiSubheading :level="3" class="pt-2">The grid</UiSubheading>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>One row per chord: section, bar, chord and scale. Two chords in a bar are two rows with the same bar number.</li>
        <li>Use the row buttons to add a row after this one, or delete it.</li>
        <li>
          The scale dropdown starts with the usual choice for that chord, then the other scales that fit, then an
          <strong class="font-semibold">Outside</strong> group for when you want some tension to resolve. <strong class="font-semibold">Other…</strong> lets you pick any root and any
          scale.
        </li>
        <li>If a chord comes up amber, I don't recognise it. Pick a scale for it and it'll draw.</li>
      </ul>

      <UiSubheading :level="3" class="pt-2">The text</UiSubheading>
      <UiText>It's plain text, one line per chord, always in concert pitch:</UiText>
      <pre class="overflow-x-auto rounded-lg bg-zinc-950/2.5 p-4 font-mono text-sm/6 text-zinc-950 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:text-white dark:ring-white/10">{{ EXAMPLE }}</pre>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>Leave the scale off and you get the chord's default (<UiCode>Cm7</UiCode> gives C Dorian).</li>
        <li>
          Chords can be written the way you'd write them on a napkin: <UiCode>Cm7</UiCode>, <UiCode>C-7</UiCode>,
          <UiCode>Am7b5</UiCode>, <UiCode>G7#9b13</UiCode>, <UiCode>EbMaj7</UiCode>, <UiCode>D7/F#</UiCode>.
        </li>
        <li>
          <UiCode>@copy A1 A2 8</UiCode> repeats section A1 as A2, eight bars later, which saves typing out every AABA
          tune twice.
        </li>
        <li>
          Name a section <UiCode>Intro</UiCode>, <UiCode>Coda</UiCode>, <UiCode>Tag</UiCode> or <UiCode>Ending</UiCode>
          and it sits outside the form: it prints where it stands, but the tune's turnaround still goes back to bar 1,
          not to the intro. Number its bars from 1 if you like.
        </li>
        <li>
          <UiCode>time: 3/4</UiCode> makes it a waltz (<UiCode>2/4</UiCode> and <UiCode>4/4</UiCode> work too; 4/4 is
          what you get without it). The guide tone sheet writes its rhythm in it.
        </li>
        <li><UiCode>title:</UiCode> and <UiCode>subtitle:</UiCode> set the heading. <UiCode>composer:</UiCode>, <UiCode>style:</UiCode>, <UiCode>key:</UiCode> and <UiCode>form:</UiCode> fill in the line under it (the subtitle, if there is one, takes the style's place), and lines starting with <UiCode>#</UiCode> are notes to yourself. A row can end in a note too, after a space and a <UiCode>#</UiCode>: the library's say why each scale was chosen.</li>
        <li>Anything I can't make sense of is listed under the text box, with the line number.</li>
      </ul>

      <UiSubheading :level="3" class="pt-2">Transposing</UiSubheading>
      <UiText>
        <strong class="font-semibold text-zinc-950 dark:text-white">Transpose…</strong> moves the whole chart to another
        key, so you can work on a tune in all twelve. It spells things sensibly for the new key (D♭–7 G♭7 in B♭, not
        C♯–7 F♯7). To undo it, transpose back. That's different from the Instrument setting, which only changes how the
        sheet is written.
      </UiText>

      <UiText v-if="!myCharts">
        <strong class="font-semibold text-zinc-950 dark:text-white">One catch:</strong> your edits aren't saved yet.
        Reload the page or open another tune and the chart is back to the library version. If you've made something you
        want to keep, print it, or copy the text out and keep it somewhere safe.
      </UiText>
    </section>

    <section v-if="myCharts" class="scroll-mt-6 space-y-4" aria-labelledby="saving">
      <UiSubheading id="saving">Saving your work</UiSubheading>
      <UiText>
        There are no accounts here, so there's nothing to sign in to. Your work is kept three ways instead, and your
        scale choices come along every time, because they're part of the chart.
      </UiText>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>
          <strong class="font-semibold text-zinc-950 dark:text-white">My charts:</strong> edits save themselves in this
          browser a moment after you stop typing. Change a library tune and it becomes your version of it, marked
          Edited, with <strong class="font-semibold">Revert to library version</strong> if you change your mind.
          <strong class="font-semibold">Save as a copy</strong> keeps a variation beside it, and
          <strong class="font-semibold">New chart</strong> starts from scratch. They're all listed at the top of the
          library.
        </li>
        <li>
          <strong class="font-semibold text-zinc-950 dark:text-white">Download</strong> saves the chart as a plain
          <UiCode>.txt</UiCode> file you can keep anywhere. <strong class="font-semibold">Open chart…</strong> in the
          library (or dropping the file on it) brings it back.
        </li>
        <li>
          <strong class="font-semibold text-zinc-950 dark:text-white">Share</strong> makes a link with the whole chart
          packed inside, plus your instrument, From root or From C, and practice picks. Open it on your phone, or
          send it to your bandmates. Nothing is uploaded: the chart lives in the link itself.
        </li>
      </ul>
      <UiText>
        <strong class="font-semibold text-zinc-950 dark:text-white">One catch:</strong> My charts lives in this
        browser only. Another browser or device won't see it, and clearing this site's data wipes it. For anything
        you'd hate to lose, download it.
      </UiText>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="printing">
      <UiSubheading id="printing">Printing and Focus</UiSubheading>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>
          <strong class="font-semibold text-zinc-950 dark:text-white">Print / Save PDF</strong> gives you clean letter
          pages, black on white whatever mode you're in: twelve staves a page for scales, eight systems a page for guide
          tones. The dashed lines on screen show where each page starts. To get a PDF, pick "Save as PDF" in your
          browser's print dialog.
        </li>
        <li>
          <strong class="font-semibold text-zinc-950 dark:text-white">Focus</strong> hides everything but the sheet
          music, for practising from a tablet or laptop on the stand. Press <kbd class="font-sans font-semibold">Esc</kbd>
          or <strong class="font-semibold">Exit focus</strong> to come back.
        </li>
      </ul>
    </section>

    <section class="scroll-mt-6 space-y-4" aria-labelledby="odds">
      <UiSubheading id="odds">Odds and ends</UiSubheading>
      <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
        <li>The moon (or sun) at the top right switches between light and dark mode.</li>
        <li>
          Your settings stay in this browser and nowhere else; there's no account and nothing to sign in to. The
          <UiTextLink href="/privacy">privacy page</UiTextLink> has the details.
        </li>
        <li>
          Missing a tune? <strong class="font-semibold text-zinc-950 dark:text-white">Request a chart</strong> in the
          library takes you to the <UiTextLink href="/contact">contact form</UiTextLink>. Tell me the tune, and if you
          can, attach a photo or PDF of the changes.
        </li>
        <li>It works on a phone, but the staves are small. A tablet or a laptop is nicer.</li>
      </ul>
    </section>
  </article>
</template>

<script setup lang="ts">
const myCharts = useFeature('myCharts')
const levelsOn = useFeature('scaleLevels')
const SECTIONS = [
  { id: 'quick', title: 'The short version' },
  { id: 'sheets', title: 'The three sheets' },
  { id: 'controls', title: 'Preview controls' },
  { id: 'practice', title: 'Practice' },
  { id: 'editing', title: 'Editing a chart' },
  ...(myCharts ? [{ id: 'saving', title: 'Saving your work' }] : []),
  { id: 'printing', title: 'Printing and Focus' },
  { id: 'odds', title: 'Odds and ends' },
]

const EXAMPLE = `title: Autumn Leaves
subtitle: Full Form

# section | bar | chord | scale
A1 | 1 | Cm7 | C Dorian
A1 | 2 | F7  | F Mixolydian
A1 | 3 | BbMaj7
A1 | 4 | EbMaj7
@copy A1 A2 4`

useHead({ title: 'Help · Chord Scale Maker' })
</script>
