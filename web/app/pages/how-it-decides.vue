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
        <UiText>
          A chord's scale comes from what it does in its key: a scale you wrote first, then a function you wrote
          (<UiCode>V7/ii</UiCode>), then the analysis rules, and only where those don't reach, the chord's usual scale.
          <UiTextLink href="/functions#rules">Functions and rules</UiTextLink> lists the rules; the note under a chord on
          the Changes sheet names the one that chose its scale.
        </UiText>

        <DecisionSection id="scale.level">
          <UiText>
            How fancy the scales get. <strong :class="EM">Basic</strong> leans on pentatonics (five notes, hard to land on a
            wrong one), <strong :class="EM">Standard</strong> is the usual chord-scale for each chord, and
            <strong :class="EM">Advanced</strong> reaches for bebop, Lydian and altered colours. Each level moves the
            scale the analysis chose, so a dominant resolving to minor climbs a different ladder from one resolving to major.
            A tonic minor chord is Aeolian at Basic.
          </UiText>
          <UiTable dense>
            <UiTableHead>
              <UiTableRow>
                <UiTableHeader>Chord</UiTableHeader>
                <UiTableHeader v-for="l in LEVELS_SHOWN" :key="l">{{ LEVEL_LABELS[l] }}</UiTableHeader>
              </UiTableRow>
            </UiTableHead>
            <UiTableBody>
              <UiTableRow v-for="ex in LEVEL_EXAMPLES" :key="ex.chord + ex.standard">
                <UiTableCell>{{ ex.chord }}</UiTableCell>
                <UiTableCell v-for="l in LEVELS_SHOWN" :key="l">{{ ex.scales[l] }}</UiTableCell>
              </UiTableRow>
            </UiTableBody>
          </UiTable>
          <UiText>
            The first row is G7 going home to C; the second is D7 as the V7 of G minor, where the analysis has already chosen
            Phrygian Dominant. <strong :class="EM">Random</strong> deals a different inside scale to every chord (never an
            outside one), so you can't coast; <strong :class="EM">Shuffle</strong> deals a new hand.
          </UiText>
          <UiText>
            A level is a view setting, like the instrument: it isn't written into the chart. The level and its shuffle are
            remembered for each chart in this browser and go with a share link. A scale you write or pick for a chord is a
            pin, and plays at every level.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> the level, and any chord's scale (pick it in the editor, or
            write it in the source).
          </UiText>
        </DecisionSection>

        <DecisionSection id="scale.unknown">
          <UiText>
            A chord I can't read, say <UiCode>Cmj7</UiCode> or a quality I don't know, comes up amber in the editor. It has no
            numeral and no scale until you pick one, its staff on the Scales sheet asks you to choose a scale, and every
            line rests on it and starts again after.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> fix the chord (<UiCode>Cmaj7</UiCode>), or pick a scale for it
            and it'll draw.
          </UiText>
        </DecisionSection>

        <DecisionSection id="scale.slash">
          <UiText>
            Some slash chords are really another chord on their bass, and take their scales from it. A major 7th over the
            note a half step below (<UiCode>D♭maj7/C</UiCode>) plays as C 7sus4♭9; a minor 7th over the note a 4th above
            its root (<UiCode>Am7/D</UiCode>) plays as D 9sus4. The chord symbol stays as you wrote it, and its labels and
            the Practice presets still read it as written. Any other slash chord takes its root's scales, its bass keeping
            its interval from the root.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> pick another of the chord's scales in the editor.</UiText>
        </DecisionSection>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="keys">
        <UiSubheading id="keys" class="scroll-mt-6">Keys</UiSubheading>

        <DecisionSection id="key.area">
          <UiText>
            The key of the moment is found from the cadences: a ii–V or a V landing on its I says where the tune is, and
            where nothing does, the chart's own key holds. The Changes sheet writes a key change in wherever that key moves,
            and every numeral and scale after it is read in the new key. A run of chords that only borrows from the next
            key, such as a <UiCode>V7/ii</UiCode>, stays in the old one.
          </UiText>
          <UiText>
            Tune Up is in D, but it's three ii–V–Is a whole step apart: <UiCode>Em7 A7 Dmaj7</UiCode>, then
            <UiCode>Dm7 G7 Cmaj7</UiCode>, then <UiCode>Cm7 F7 B♭maj7</UiCode>. So the sheet writes C major over bar 5 and
            B♭ major over bar 9, and reads the <UiCode>Dm7</UiCode> as ii in C, not as i in D.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> a key change of your own (Key change here, in a bar's menu,
            or <UiCode>@key</UiCode> in the source), a section's <UiCode>key:</UiCode>, or a chord's function, which
            settles the rules without pinning a scale. See <UiTextLink href="/functions#writing">Functions and rules</UiTextLink>.
          </UiText>
        </DecisionSection>
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

        <DecisionSection id="spell.root">
          <UiText>
            Every scale is worked out from its formula, then spelled the easiest way to read: no double flats or sharps, no
            B♯, E♯, C♭ or F♭, then the fewest accidentals, and on a tie the sharp or flat side it was written on. So a
            scale on the ♭2 of B♭ starts on B, not C♭, and G♭ Ionian (six flats) stays G♭, not F♯ (six sharps), because you wrote
            it flat.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> Spell Scale on the Scales sheet starts every scale on another
            note; the spelling rule still applies.
          </UiText>
        </DecisionSection>

        <DecisionSection id="spell.chord">
          <UiText>
            A chord symbol follows its scale's spelling when they share a root, so the chord and the staff under it agree.
            Each guide tone and arpeggio note keeps its chord's spelling too: the 7th of G♭7 is F♭, not E. A slash bass
            keeps its interval from the root: in <UiCode>D7/F♯</UiCode> the bass is D's major 3rd, so it's F♯, never G♭.
          </UiText>
        </DecisionSection>

        <DecisionSection id="spell.transpose">
          <UiText>
            Transpose… moves the chart to a new concert key and spells each root on that key's side: in B♭ a ii–V is
            <UiCode>D♭–7 G♭7</UiCode>, not <UiCode>C♯–7 F♯7</UiCode>, even when a scale then has a C♭ or F♭ in it. In C
            and A minor, which have no side, and wherever that side would need double flats or sharps, the plain rule above
            decides.
          </UiText>
          <UiText>
            That's different from the Instrument setting, which never changes the chart, only how it's written for you; the
            written parts use the plain rule alone.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> transpose back to undo.</UiText>
        </DecisionSection>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="ranges">
        <UiSubheading id="ranges" class="scroll-mt-6">Ranges</UiSubheading>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { LEVEL_LABELS, scaleAtLevel, type ScaleLevel } from '@chord-scale-maker/engine'
import { PAGE_HEAD, seoMeta } from '~/utils/site'

/** a run-in label in the prose: "What you can change:" */
const EM = 'font-semibold text-zinc-950 dark:text-white'

/** the level table, from the engine so it can't drift: G7 on its usual scale, D7 where the analysis chose Phrygian Dominant */
const LEVELS_SHOWN = ['basic', 'standard', 'advanced'] as const satisfies readonly ScaleLevel[]
const LEVEL_EXAMPLES = [
  { chord: 'G7', standard: '' },
  { chord: 'D7', standard: 'D Phrygian Dominant' },
].map((ex) => ({ ...ex, scales: Object.fromEntries(LEVELS_SHOWN.map((l) => [l, scaleAtLevel(ex.chord, l, 0, '', ex.standard || undefined)])) }))

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
