<template>
  <div class="lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12">
    <!-- from lg: the text, and its index in a column beside it -->
    <article class="max-w-3xl space-y-12">
      <header class="space-y-3">
        <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">How it decides</p>
        <UiHeading>How it decides</UiHeading>
        <UiText>
          Everything the app chooses for you, and the rule it uses: which scale, which guide tone, which pentatonic, how a
          note is spelled. Each section says what it decides, how, with an example, and what you can change.
          <UiTextLink href="/help">Help</UiTextLink> is the how-to; this is the why.
        </UiText>
        <div class="space-y-3 pt-2">
          <UiSubheading>A disclaimer</UiSubheading>
          <UiText>
            One critical thing to know about this site: music both is and isn't math. I'm not a PhD in music theory, and my
            degree is in computer science. I've been writing software for about thirty years and playing vibraphone for
            about ten. I know enough to make this work, but the logic behind the functional analysis was put together by
            compiling many internet resources and boiling them down to a series of logical tests.
          </UiText>
          <UiText>
            But jazz isn't made of logic, it's made of art. I'm not a good enough player to know if the analysis is right in all
            cases, and I don't have the time to check every tune in the library. If you see something that looks wrong,
            please <UiTextLink href="/contact">let me know</UiTextLink> and I'll fix it. The sections below say how each
            choice is made, and the note under a chord on the Changes sheet names the rule that chose its scale, so you
            can check the logic for yourself or tell me what to fix.
          </UiText>
        </div>
        <PageIndex :sections="SECTIONS" />
      </header>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="scales">
        <UiSubheading id="scales" class="scroll-mt-6">Scales</UiSubheading>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="keys">
        <UiSubheading id="keys" class="scroll-mt-6">Keys</UiSubheading>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="guide-tones">
        <UiSubheading id="guide-tones" class="scroll-mt-6">Guide tone lines</UiSubheading>
        <UiText>
          From 3rd and From 7th put one note a chord on the Changes staff, the 3rd or 7th that tells you which chord you're
          on. A line is built the way you'd build one by hand, a chord at a time.
        </UiText>

        <DecisionSection id="guide.tones">
          <UiText>
            Each chord's 3rd and 7th. Where a chord has no 7th or no 3rd, something else stands in: a 6 chord uses its 6th, a
            sus chord its 4th, and a plain triad its root. (A diminished 7th's 7th is its double-flat 7th.) The label under
            the note is that degree without its flat or sharp: 3, 7, 6, 4 or 1.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> the chord. <UiCode>C6</UiCode> in place of
            <UiCode>Cmaj7</UiCode> gives the line an A where it had a B.
          </UiText>
        </DecisionSection>

        <DecisionSection id="guide.start">
          <UiText>
            From 3rd begins on the first chord's 3rd, From 7th on its 7th, in whichever octave keeps the line, up to the next
            rest, closest on average to the middle of your instrument's range. So a line doesn't start in the middle and
            drift to the bottom.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> the range (Lowest and Highest note, under Instrument), which
            moves the middle.
          </UiText>
        </DecisionSection>

        <DecisionSection id="guide.move">
          <UiText>
            At each new chord the line goes to whichever of its two guide tones is nearer: a common tone first, then a half
            step, a whole step, and only then a leap. That's why it swaps between 3rd and 7th when the roots move by 4ths and
            5ths. When both are equally near, it takes the one nearer the middle of the range, then the lower. A chord that
            repeats the last one's guide tones (C7 to C7♭9) ties the note over; a common tone on a different chord is played
            again.
          </UiText>
          <UiText>A ii–V–I in C, concert pitch, a chord a bar:</UiText>
          <UiTable dense>
            <UiTableHead>
              <UiTableRow>
                <UiTableHeader>Line</UiTableHeader>
                <UiTableHeader>Dm7</UiTableHeader>
                <UiTableHeader>G7</UiTableHeader>
                <UiTableHeader>Cmaj7</UiTableHeader>
                <UiTableHeader>Cmaj7</UiTableHeader>
              </UiTableRow>
            </UiTableHead>
            <UiTableBody>
              <UiTableRow>
                <UiTableCell class="font-semibold">From 3rd</UiTableCell>
                <UiTableCell>F4 (3)</UiTableCell>
                <UiTableCell>F4 (7)</UiTableCell>
                <UiTableCell>E4 (3)</UiTableCell>
                <UiTableCell>E4, tied</UiTableCell>
              </UiTableRow>
              <UiTableRow>
                <UiTableCell class="font-semibold">From 7th</UiTableCell>
                <UiTableCell>C5 (7)</UiTableCell>
                <UiTableCell>B4 (3)</UiTableCell>
                <UiTableCell>B4 (7)</UiTableCell>
                <UiTableCell>B4, tied</UiTableCell>
              </UiTableRow>
            </UiTableBody>
          </UiTable>
          <UiText>
            From 3rd keeps the F as G7's 7th, then falls a half step to E. From 7th falls a half step to B and keeps it as the
            Cmaj7's 7th. The repeated Cmaj7 ties both over.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> which line you see, From 3rd or From 7th.</UiText>
        </DecisionSection>

        <DecisionSection id="guide.range">
          <UiText>
            The line only uses notes your instrument can comfortably play, so at the floor or the ceiling it turns back toward
            the middle. The ranges are under <UiTextLink href="#range.instrument">Written ranges</UiTextLink>.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> Lowest and Highest note, under Instrument.
          </UiText>
        </DecisionSection>

        <DecisionSection id="guide.meet">
          <UiText>
            You see one line at a time, but the other is worked out alongside it. If both land on the same note, they part at
            the next new chord. If that chord has the note too, the line that was lower keeps it and the other moves to the
            chord's other guide tone, upward if that's no more than a tritone away. Otherwise the one that was higher goes up
            to the nearest guide tone above and the other down to the nearest below. Neither leaps more than a tritone just to
            get away: a line with nothing that close on its side moves as it would on its own, so now and then the two stay
            together for another chord. So From 3rd and From 7th may touch, but they rarely stay together.
          </UiText>
        </DecisionSection>

        <DecisionSection id="guide.rest">
          <UiText>
            A chord with no guide tones (one I can't read, or a chord quality I don't know) gets a rest, and the line starts
            again after it, placed the same way as at the start. Repeats and endings are played in the order they're written:
            a second ending carries on from the chord before it, and the last bar doesn't lead back to the top. Each note keeps
            its chord's spelling: the 7th of G♭7 is F♭, not E.
          </UiText>
        </DecisionSection>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="lines">
        <UiSubheading id="lines" class="scroll-mt-6">The other lines</UiSubheading>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="superimposing">
        <UiSubheading id="superimposing" class="scroll-mt-6">Superimposing</UiSubheading>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="spelling">
        <UiSubheading id="spelling" class="scroll-mt-6">Spelling</UiSubheading>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="ranges">
        <UiSubheading id="ranges" class="scroll-mt-6">Ranges</UiSubheading>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta } from '~/utils/site'

/** a run-in label in the prose: "What you can change:" */
const EM = 'font-semibold text-zinc-950 dark:text-white'

const SECTIONS = [
  { id: 'scales', title: 'Scales' },
  { id: 'keys', title: 'Keys' },
  { id: 'guide-tones', title: 'Guide tone lines' },
  { id: 'lines', title: 'The other lines' },
  { id: 'superimposing', title: 'Superimposing' },
  { id: 'spelling', title: 'Spelling' },
  { id: 'ranges', title: 'Ranges' },
]

const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD['how-it-decides']))
</script>
