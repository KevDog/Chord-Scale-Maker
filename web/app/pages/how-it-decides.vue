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
            <strong :class="EM">Advanced</strong> reaches for bebop, Lydian and altered colors. Each level moves the
            scale the analysis chose, so a dominant resolving to minor climbs a different ladder from one resolving to major.
            A tonic minor chord is Aeolian at Basic, and in a blues the I, IV and V play the key's Blues scale
            (<UiTextLink href="#scale.blues">a blues</UiTextLink>).
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
            Phrygian Dominant. <strong :class="EM">Random</strong> deals every chord its own inside scale (never an outside
            one), so you can't coast; <strong :class="EM">Shuffle</strong> deals a new hand.
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

        <DecisionSection id="scale.blues">
          <UiText>
            A chart reads as a blues when its form is a 12- or 24-bar blues, or its header says
            <UiCode>context: blues</UiCode> (<strong :class="EM">Read: Blues</strong> beside the editor's Key, or Read as under Details on a phone), whatever
            its form: a 9-, 13- or 16-bar Delta blues too.
          </UiText>
          <UiText>
            In a blues the I7, the IV7 and a V7 with nowhere it must go are Mixolydian, and so is a triad or 6 chord on I, IV
            or V (a maj7 says its 7th is major, and keeps the major rules). In a minor blues the i and iv are Dorian; its V7
            takes the minor key's scale. At <strong :class="EM">Basic</strong> each of those plays the key's Blues scale,
            1 ♭3 4 ♭5 5 ♭7: E Blues over E7, A7 and B7, the way blues players start. <strong :class="EM">Advanced</strong>
            climbs each chord's own ladder, Mixolydian to Bebop Dominant.
          </UiText>
          <UiText>
            Chords that leave the blues, a ii–V or a turnaround's VI7, keep their own rules at every level.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> Read as, a chord's scale, or its function.
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
            sus chord its 4th, an augmented triad its 5th, and any other plain triad its root. (A diminished 7th's 7th is its
            double-flat 7th.) The label under the note is that degree without its flat or sharp: 3, 7, 6, 4, 5 or 1.
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
        <UiText>
          The Changes sheet's Line has two more modes than guide tones, and the Arpeggios and Patterns sheets run their own
          figures over each scale. They share their rhythm, their turns and their ranges.
        </UiText>

        <DecisionSection id="arp.line">
          <UiText>
            <strong :class="EM">7th Chords</strong> plays each chord's four chord tones: its 7th chord as written, altered
            5ths kept and extensions left off (<UiCode>G7♭9</UiCode> plays G B D F), and a triad's root again as its fourth
            note. The pattern list chooses the order: up or down from the root or an inversion, up and down by turns, or
            voice-led, each arpeggio starting on the chord tone nearest the last note.
          </UiText>
          <UiText>
            The note value is set bar by bar: the longest that gives the bar's shortest chord four notes. In 4/4 one chord
            gets quarters, two get eighths, three or four get sixteenths. A chord that lasts longer repeats its arpeggio; one
            with too few slots for another whole one turns back on it (six eighths in 3/4: 1 3 5 7 5 3).
          </UiText>
          <UiText v-if="rhythmOn">A chosen Rhythm replaces this note value: the line plays in the rhythm instead.</UiText>
          <UiText>
            Each arpeggio is placed whole, in the octave that starts it nearest the last note, but never so it runs mostly
            outside the comfortable middle of your range: a line climbing chord after chord turns back rather than drifting
            to the top.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> the pattern, and the range under Instrument.</UiText>
        </DecisionSection>

        <DecisionSection id="cells.line">
          <UiText v-if="cellsOn">
            <strong :class="EM">Cells</strong>, in the 7th Chords pattern list, put a four-note cell on each chord, two beats
            each, after Randy Vincent's <em>Building Solo Lines From Cells</em>. A cell is four scale degrees counted from the
            chord's root (<UiCode>1 2 3 5</UiCode>), read through the chord's scale, so it bends to fit each chord. A single
            cell plays in every two beats; a system takes turns (below). Under a Superimpose the slot plays the Pentatonic or
            Triad pair line instead.
          </UiText>
          <UiText v-else>Cells aren't switched on yet.</UiText>
        </DecisionSection>

        <DecisionSection id="cells.system">
          <UiText v-if="cellsOn">
            A cell system has two cells, A and B, that take turns, chosen so that each ends a step from where the next begins:
            root to root, 3rd to 3rd, 3rd to 5th or 3rd to root. Played through a tune, the line keeps moving by step across
            every chord change.
            <template v-if="phraseCellsOn">
              With <strong :class="EM">Phrase</strong> on, the default for a system, each cell is chosen to end a
              step from the first note of what follows it, the next chord's target. When the system's own cell already
              ends a step away, it stays. If no cell fits, the cell is followed by its own turn-back, what follows plays
              its arpeggio, or the slot isn't a whole cell of eighths, it plays as the system has it. Off plays the
              system as written.
              <strong :class="EM">Order</strong> then plays each cell as written, reversed, rotated or with its pairs swapped.
            </template>
          </UiText>
          <UiText v-if="cellsOn && phraseCellsOn">
            With Phrase on, a dominant 7th that lasts two cells or more and resolves (the next chord's root a 5th or a half
            step below, a blues I7 to IV7 too) borrows substitutes, as jazz players do: its first cell is its own, the second
            is read through the tritone substitute's Lydian Dominant (over G7, D♭7), the third through the dominant a minor 3rd
            up on Half-Whole Dim. (B♭7), the fourth the tritone substitute again, and so on. The chord symbol stays as written.
            A sus chord, a dominant whose scale the chart writes, and the last chord before a rest or the end play their own.
          </UiText>
          <UiText v-else-if="!cellsOn">Cells aren't switched on yet.</UiText>
        </DecisionSection>

        <DecisionSection id="approach.figures">
          <UiText v-if="approachesOn">
            <strong :class="EM">Approach</strong>, under Guide Tones, leads into each chord's note with a short figure of
            eighths: a note a semitone below or above, a pair from one side, an enclosure (a step above in the scale, then a
            semitone below) and more. A step in the scale is spelled from the scale the sheet shows over the chord
            before; a chromatic note is never B♯, E♯, C♭ or F♭ (into B♭ from above, it's B). Two equal notes in a row
            become one.
          </UiText>
          <UiText v-else>Approaches aren't switched on yet.</UiText>
        </DecisionSection>

        <DecisionSection id="approach.place">
          <UiText v-if="approachesOn">
            The target note still lands on its chord's first beat; the chord before gives up its last beat or two to make
            room, and a note tied over is broken. Under 7th Chords<template v-if="cellsOn"> and the cells</template> (with
            Superimpose off) the figure takes the place of the chord before's last notes, in the line's own rhythm. There's no approach into the first chord, after
            a rest, where the chord before would keep less than an eighth, or where a note of the figure would leave your
            range. A figure whose first note is the one the line is already on leaves it there: from the 3rd through
            <UiCode>Dm7 G7 Cmaj7</UiCode>, a chromatic approach from above into E is just G7's F, held.
          </UiText>
          <UiText v-else>Approaches aren't switched on yet.</UiText>
          <UiText v-if="approachesOn"><strong :class="EM">What you can change:</strong> the figure, or None.</UiText>
        </DecisionSection>

        <DecisionSection id="arp.sheet">
          <UiText>
            The Arpeggios sheet has one staff for each of the Scales sheet's lines, in eighths. <strong :class="EM">7th
            Chord</strong> runs the chord tones over two octaves and closes on the root (1 3 5 7 1 3 5 7 1; a triad
            1 3 5 1 3 5 1). <strong :class="EM">Extended</strong> plays the chord tones once and stacks the scale's other
            notes above them: the 9th, 11th and 13th, in that order. Up, Down, or Up &amp; down, which doesn't repeat the top
            note. The run is placed with the fewest notes out of your range; two octaves outrun most, so the rest go on
            ledger lines.
          </UiText>
        </DecisionSection>

        <DecisionSection id="patterns.run">
          <UiText v-if="patternsOn">
            A pattern is a list of steps between neighboring notes: <UiCode>+2 −1</UiCode> is up a third, back a step. The
            Patterns sheet runs it over each scale line, through the scale or through the chord tones: the group starts again
            from each next note up an octave, then the octave itself closes the run. Down is the same run reflected; Up &amp;
            down goes up and comes back from the top. Each run is placed whole with the fewest notes out of your range.
          </UiText>
          <UiText v-else>Patterns aren't switched on yet.</UiText>
          <UiText v-if="patternsOn"><strong :class="EM">What you can change:</strong> the pattern (or write your own), Scale or Chord tones, and the direction.</UiText>
        </DecisionSection>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="superimposing">
        <UiSubheading id="superimposing" class="scroll-mt-6">Superimposing</UiSubheading>
        <UiText>
          Superimpose (on the Changes) and the Practice panel's Pentatonic, Hexatonic and Quartal (on the Scales) lay a smaller set
          of notes over each chord. A chord pick made on one sheet plays on the other.
        </UiText>

        <DecisionSection id="pent.auto">
          <UiText>
            Each chord's scale is set against all twelve minor pentatonics. They're ranked by how many notes they share with
            the scale, and among those that share as many, the one fewest fifths from the chord's root comes first, the flat
            side before the sharp. <strong :class="EM">Auto</strong> plays the top one. That's the Scales sheet's rule, and
            the Changes sheet's with Ranked against Chord; with Ranked against Key, where the Changes starts, each key area
            has one pentatonic for all its chords (<UiTextLink href="#pent.inside">the ladder</UiTextLink>). Over
            <UiCode>Cmaj7</UiCode> (C Ionian), the top three:
          </UiText>
          <UiTable dense>
            <UiTableHead>
              <UiTableRow>
                <UiTableHeader>Pentatonic</UiTableHeader>
                <UiTableHeader>Notes shared</UiTableHeader>
              </UiTableRow>
            </UiTableHead>
            <UiTableBody>
              <UiTableRow v-for="p in PENT_EXAMPLE" :key="p.name">
                <UiTableCell>{{ p.name }}</UiTableCell>
                <UiTableCell>{{ p.shared }}</UiTableCell>
              </UiTableRow>
            </UiTableBody>
          </UiTable>
          <UiText>
            <strong :class="EM">What you can change:</strong> Built on picks a degree of every chord instead (on 2 over
            Cmaj7 is Dm, over G7 it's Am), and a chord pick changes one chord.
          </UiText>
        </DecisionSection>

        <DecisionSection id="pent.inside">
          <UiText>
            Five notes shared is wholly inside: every note of the pentatonic is in the scale. {{ PENT_INSIDE_HELP }} Fewer
            shared is further out, so a pick from lower in the list is a deliberate step outside.
          </UiText>
          <UiText>
            On the Changes, Ranked against Key sets each key area's twelve on a ladder round the circle of fifths from home
            (its tonic minor: Am in C major), each rung sharing fewer notes with the key: 5, 5, 4, 3, 2, 1, 0. Rung, Side
            and Path move along it.
          </UiText>
        </DecisionSection>

        <DecisionSection id="pent.line">
          <UiText>
            While Superimpose is Pentatonic, the Line's 7th Chords slot plays each chord's pentatonic, the one its label
            shows, in four-note cells: the pentatonic less the note <strong :class="EM">Leave out</strong> chooses (leave
            out 1 and Am pentatonic plays C D E G). The first cell starts on its bottom note going up (its top going down);
            each later one starts on its note nearest the last one played and goes the way you chose, unless it would run past
            your range, when it turns the other way. A chord with no pentatonic plays its 7th chord arpeggio.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> Leave out, and the direction.</UiText>
        </DecisionSection>

        <DecisionSection id="hex.auto">
          <UiText>
            A triad pair is two triads from the chord's scale with no note in common: six notes, after Gary Campbell's
            <em>Triad Pairs for Jazz</em>. Pair <em>n</em> is the triads on degrees <em>n</em> and <em>n</em> + 1 of the
            scale. <strong :class="EM">Auto</strong> takes the pair that covers the most chord tones, then one whose
            triads are both major or minor, then the one nearest the chord's root by fifths. Over <UiCode>Cmaj7</UiCode>
            that's <UiCode>{{ HEX_EXAMPLE }}</UiCode>.
          </UiText>
          <UiText>
            A symmetric scale has pairs its chain of triads doesn't reach, after Walt Weiskopf's <em>Intervalic
            Improvisation</em>; they join the list after the chain's. On a diminished scale: its major triads a tritone
            apart, then its minor ones (<UiCode>C/F♯</UiCode> over <UiCode>C7♭9</UiCode>, which Auto now picks: it
            covers as many chord tones as <UiCode>E♭/Am</UiCode> and sits on the root). On the whole-tone scale, which has
            no chain: its two augmented triads, a whole step apart (<UiCode>C+/D+</UiCode> over <UiCode>C7♯5</UiCode>). On
            the augmented scale (1 ♯2 3 5 ♯5 7, the Advanced level's scale over <UiCode>Cmaj7♯5</UiCode> and
            <UiCode>C+</UiCode>): its two augmented triads, a minor third apart (<UiCode>C+/D♯+</UiCode>).
            Pair <em>n</em> counts the chain's pairs only; pick an off-chain pair from the chord's list.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> Pair, Ranked against, and a chord pick for one chord.</UiText>
        </DecisionSection>

        <DecisionSection id="hex.sub">
          <UiText>
            Over a dominant chord, a pair can come from its tritone substitute, after Walt Weiskopf's <em>Intervalic
            Improvisation</em>: <UiCode>B/D♭</UiCode> over <UiCode>G7</UiCode> takes its triads from D♭7's Mixolydian. B is
            G7's 3rd; D♭, F and A♭ its ♭5, 7th and ♭9. A dominant's pick list ends, under <em>From the tritone sub</em>,
            with up to two such pairs of major and minor triads: those covering the most of the chord's tones, a pair
            holding the sub's own triad first. A pair the chord's scale already has isn't repeated. They're never Auto and
            Pair <em>n</em> doesn't count them; pick one for a chord and it lights the notes of it the staff holds.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> a chord pick for one chord.</UiText>
        </DecisionSection>

        <DecisionSection id="hex.key">
          <UiText>
            Ranked against <strong :class="EM">Key</strong>, every chord in a key area takes the same pair, after Walt
            Weiskopf's <em>Intervalic Improvisation</em>: the major triads on 4 and 5 of a major key (<UiCode>F/G</UiCode>
            across <UiCode>Dm7 G7 Cmaj7</UiCode> in C), and harmonic minor's minor iv and augmented V in a minor key
            (<UiCode>Gm/A+</UiCode> in D minor). Where a chord's scale doesn't hold the key's pair (a Dm6's scale, with its
            B♮, holds no G minor triad), it plays its own Auto pair, grayed. The label prints once for the run, as the
            pentatonics' do. On the Scales sheet the Hexatonic preset ranks each staff likewise, by the key area of the
            first chord it covers; the Arpeggios sheet's Triad pairs follow the Changes sheet's choice.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> Ranked against (Key or Chord), and a chord pick for one chord.</UiText>
        </DecisionSection>

        <DecisionSection id="hex.group">
          <UiText>
            On the Scales sheet the six notes are split in two and tinted apart, by the grouping you choose: the two triads,
            the chord tones and the color notes, a pentatonic and one more, or the lowest three and highest three.
          </UiText>
        </DecisionSection>

        <DecisionSection id="hex.line">
          <UiText>
            While Superimpose is Hexatonic, the 7th Chords slot plays each chord's pair a triad at a time, its lower triad
            first: <UiCode>G/Am</UiCode> plays G B D, then A C E from the note nearest D. The direction, the starts and the
            turns at your range's edges are the Pentatonic line's. Up &amp; down turns with each triad; where a chord has room
            for one triad and a note of the next, the cut triad doesn't count, so the chords alternate up and down. A chord
            with no pair plays its 7th chord arpeggio.
          </UiText>
          <UiText>
            That is the <strong :class="EM">Nearest</strong> shape. Two more follow Walt Weiskopf's exercises in
            <em>Intervalic Improvisation</em>. <strong :class="EM">Climb</strong> plays both triads in root position, then
            both in first inversion, then second, each starting on its note just above the last triad's start:
            <UiCode>F/G</UiCode> plays F A C, G B D, A C F, B D G, C F A, D G B. Down mirrors it, from the upper triad's
            second inversion top down; Up &amp; down climbs the six triads up, then six down.
            <strong :class="EM">Arpeggios</strong> is the Climb with each triad 1 3 5 8 (F A C F, G B D G, …), four notes, so
            each lands on the beat; one whose octave fits nowhere in your range drops its 8. A triad that would leave the
            range is placed nearest the last note instead, and the climb goes on from there.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> the shape and the direction (Line options).</UiText>
        </DecisionSection>

        <DecisionSection id="hex.sheet">
          <UiText>
            The Arpeggios sheet's <strong :class="EM">Triad pairs</strong> writes each line's pair as six triads, the lower
            and the upper in turn through root position, 1st and 2nd inversion, after Weiskopf's <em>Intervalic
            Improvisation</em>: <UiCode>F/G</UiCode> plays F A C, G B D, A C F, B D G, C F A, D G B. The pair is the one the
            Changes sheet's Hexatonic shows: Auto (or the key's pair, ranked against Key), or your chord pick, which you can make from the staff's caption. Each
            triad's next inversion starts on the next note up of its own triad, and the upper triad starts nearest the
            lower. The figure is placed whole with the fewest notes out of your range, nearest its middle; a triad still
            out moves an octave, whole. <strong :class="EM">Block</strong> writes the six triads as chords; otherwise
            Up, Down, or Up &amp; down, which doesn't repeat the top note. A chord with no pair plays its 7th chord
            arpeggio.
          </UiText>
        </DecisionSection>

        <DecisionSection id="quartal.auto">
          <UiText>
            A quartal stack is a seven-note scale's notes three steps apart, so each two a fourth apart, from one degree:
            three or four notes. A stack keeps perfect fourths and at most one augmented fourth (none with
            <strong :class="EM">Perfect only</strong>); a diminished fourth rules it out. <strong :class="EM">Auto</strong>
            takes a stack without an avoid note (a scale note a half step above a chord tone, like F over Cmaj7), then the
            one holding the most guide tones, then perfect fourths before an augmented one, then the most chord tones, then
            the bottom note nearest the chord's root by fifths. Over the ii–V–I in C: <UiCode>D G C F</UiCode> on Dm7,
            <UiCode>F B E A</UiCode> on G7 (its tritone holds both guide tones) and <UiCode>B E A D</UiCode> on Cmaj7.
            A scale that isn't seven notes has no stack.
          </UiText>
          <UiText>
            The Scales sheet's Quartal preset lights it on each staff; the Changes sheet's Quartal Superimpose names it under
            each chord, where the stack changes. Click a name there to pick another stack: the list runs in Auto's order.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> Built on (a degree of each scale, on the Scales sheet), Notes (3 or 4), Perfect only, and a pick on the Changes sheet.</UiText>
        </DecisionSection>

        <DecisionSection id="quartal.line">
          <UiText>
            While Superimpose is Quartal, the 7th Chords slot plays each chord's stack of fourths, the one its label names,
            whole: bottom up or top down, never turned inside out. Each later stack on the same chord is the next one in
            Auto's order that isn't the stack just played, so a held chord planes from stack to stack. Each is placed nearest
            the last note; a stack that fits no octave of your range gives way to the next, and a chord never starts on the
            note the last one ended on. Over the ii–V–I in C: <UiCode>D4 G4 C5 F5</UiCode>, then <UiCode>A5 E5 B4 F4</UiCode>
            down, then <UiCode>E4 A4 D5 G5</UiCode> (<UiCode>B E A D</UiCode> doesn't fit C4–A5). A three-note stack the
            beat cuts goes on into the next beat, as the Triad pair line's triads do. A chord with no stack plays its 7th
            chord arpeggio.
          </UiText>
          <UiText>
            <strong :class="EM">Notes</strong> (Quartal options): Auto stacks four notes where two of the chord's
            four-note stacks fit your range (a four-note stack spans an octave and a minor third, or a major third with an augmented fourth), else three.
          </UiText>
          <UiText><strong :class="EM">What you can change:</strong> the direction (Line options), Notes, Perfect only, and a pick.</UiText>
        </DecisionSection>

        <DecisionSection id="pick.order">
          <UiText>
            Click a chord's pentatonic or triad pair to pick another; the list runs from inside to outside, in the order
            above (most shared, or most chord tones covered, first), with the sheet's own choice at the top. A pick holds for
            that chord on both sheets, through changes of Built on, Pair, Path, Rung or Side, and goes with a share link. It
            isn't written into the chart. Rewrite the chord, or move the level so it gets another scale, and the pick rests
            until it fits again; change the chart's key and the picks clear.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> Sheet's choice undoes one pick; ⋯ More actions → Reset chord
            picks undoes them all.
          </UiText>
        </DecisionSection>
      </section>

      <section class="scroll-mt-6 space-y-8" aria-labelledby="spelling">
        <UiSubheading id="spelling" class="scroll-mt-6">Spelling</UiSubheading>

        <DecisionSection id="spell.root">
          <UiText>
            Every scale is worked out from its formula, then spelled the easiest way to read: no double flats or sharps, as
            few B♯s, E♯s, C♭s and F♭s as it can, then the fewest accidentals, and on a tie the sharp or flat side it was written on. So a
            scale on the ♭2 of B♭ starts on B, not C♭, and G♭ Ionian (six flats, a C♭ among them) stays G♭, not F♯ (six sharps, an
            E♯ among them), because you wrote it flat.
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

        <DecisionSection id="range.instrument">
          <UiText>
            Every line on the Changes keeps to a comfortable written range for your instrument, not its whole compass. Guide
            tone lines turn back at its floor and ceiling; arpeggio and cell lines turn back sooner, keeping mostly between a
            4th above the lowest note and a major 3rd below the highest. The Arpeggios sheet's two-octave runs are placed
            with as few notes outside it as they can, and the rest go on ledger lines.
          </UiText>
          <UiTable dense>
            <UiTableHead>
              <UiTableRow>
                <UiTableHeader>Instrument</UiTableHeader>
                <UiTableHeader>Written range</UiTableHeader>
              </UiTableRow>
            </UiTableHead>
            <UiTableBody>
              <UiTableRow v-for="r in RANGES" :key="r.name">
                <UiTableCell>{{ r.name }}</UiTableCell>
                <UiTableCell>{{ r.range }}</UiTableCell>
              </UiTableRow>
            </UiTableBody>
          </UiTable>
          <UiText>
            <strong :class="EM">What you can change:</strong> Lowest and Highest note, under Instrument, for every line.
          </UiText>
        </DecisionSection>
      </section>
      <section v-if="metronomeOn" class="scroll-mt-6 space-y-8" aria-labelledby="click">
        <UiSubheading id="click" class="scroll-mt-6">The click</UiSubheading>

        <DecisionSection id="click.tempo">
          <UiText>
            The click starts at a tempo read from the chart's style, by the first word that matches: a
            <strong :class="EM">medium ballad</strong> at 84 and any other ballad at 66, <strong :class="EM">slow</strong> at 72,
            <strong :class="EM">medium up</strong> at 160 (before medium), <strong :class="EM">up</strong> or fast at 220, a
            <strong :class="EM">waltz</strong> at 150, and medium, swing, blues, Latin, bossa, samba, even or straight 8ths,
            funk and rock at 132. A style with none of these words starts at 120.
          </UiText>
          <UiText>
            The feel is read on its own: Latin, bossa, samba, even or straight 8ths, funk and rock play
            <strong :class="EM">straight</strong>, everything else swings, so an up samba is fast and straight. Swing plays the
            skip note two thirds through each beat, straight an eighth halfway; Quarters, the beats alone, is one tap away. It plays the
            chart's time signature, the one it starts in, all the way through: a chart that changes meter partway keeps its
            first until the click can follow the form.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> the tempo and the feel, on the click itself. The chart remembers
            them, so a tune opens at the tempo you last practiced it at.
          </UiText>
        </DecisionSection>

        <DecisionSection id="click.pattern">
          <UiText>
            <strong :class="EM">Click on</strong> (after Bergonzi) picks the beats the click sounds: every beat, 2 and 4, 1 and 3,
            3 only, 4 only, or the and of 2 and 4, where the feel puts its eighth (two thirds through the beat in Swing, halfway
            otherwise). With a pattern, the click plays nothing between the beats; the count-in still counts every beat, and the
            lights still follow every beat, so you keep your place while you play the rest. Until you choose one, it follows the
            rhythm's Feel: <strong :class="EM">in 4</strong> every beat, <strong :class="EM">in 2</strong> 2 and 4, the hi-hat of a
            swing feel, and <strong :class="EM">in 1</strong> 4 alone, one click a bar. A bar too short for a pattern (2 and 4, 4
            only and the and of 2 and 4 in 3/4) plays every beat.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> Click on, under the click's ⋯. The chart remembers it.
          </UiText>
        </DecisionSection>

        <DecisionSection v-if="hearLineOn" id="hear.pitch">
          <UiText>
            <strong :class="EM">Hear line</strong> plays the Line on the Changes sheet with the click, at concert pitch: a trumpet's
            written D sounds as C. It leaves out the octave some instruments sound below what they read (tenor and bari sax,
            guitar, bass), as the sheet does, so their Line sounds where a C instrument would read it. It plays the bars as
            drawn, from the top again at the end; repeat signs, endings and D.S. aren't followed yet, and a bar longer than the
            click's meter leaves out the notes past its beats.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> the instrument changes the Line, and so what you hear.
          </UiText>
        </DecisionSection>

        <DecisionSection v-if="hearLineOn" id="hear.swing">
          <UiText>
            With the click's feel on <strong :class="EM">Swing</strong>, Hear line and Hear rhythm swing the 8ths: an 8th off the beat
            plays two thirds through the beat, where the click's skip note is, and the note before it holds until then.
            Triplets, 16ths and the rest play as drawn. Straight and Quarters play every note as drawn.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> the click's feel.
          </UiText>
        </DecisionSection>

        <DecisionSection v-if="hearLineOn" id="hear.rhythm">
          <UiText>
            <strong :class="EM">Hear rhythm</strong> taps the Changes sheet's rhythm on a rim, a short knock unlike the click,
            at the attacks drawn: the rhythm line's with the Line off, or the Line's with a Line poured into the rhythm, so the
            two always agree. Accented notes sound louder; a rest, or a note tied over from the one before, strikes nothing. A
            guide tone line without Restate takes no rhythm, so there is nothing to tap. It swings as Hear line does.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> Hear rhythm, under the click's ⋯ (on until you turn it off), and the
            rhythm itself.
          </UiText>
        </DecisionSection>

        <DecisionSection v-if="hearLineOn" id="hear.play">
          <UiText>
            A staff's <strong :class="EM">Play</strong> sounds a Scales staff up and down, the top note once, in 8ths at the
            click's tempo, the last note a quarter; with Practice on, only the notes picked, in the same order. An Arpeggios
            staff plays its notes as drawn, in 8ths; a Block triad pair plays each group as one chord, a quarter each. A
            pentatonic on a Changes label's ladder plays its minor pentatonic from the root up to the octave and back, in 8ths,
            its root where a Scales staff's root sits. It sounds at concert pitch and swings as Hear line does. With the click stopped it starts at once; with the click
            running it starts on the click's next bar.
          </UiText>
          <UiText>
            <strong :class="EM">What you can change:</strong> the click's tempo and feel, and Practice's notes.
          </UiText>
        </DecisionSection>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { CONCERT, hexatonicChoices, INSTRUMENTS, type InstrumentName, LEVEL_LABELS, noteName, pentatonicChoices, scaleAtLevel, type ScaleLevel } from '@chord-scale-maker/engine'
import { instrumentOption } from '~/utils/instrumentChoices'
import { PENT_INSIDE_HELP } from '~/utils/pentatonics'
import { PAGE_HEAD, seoMeta } from '~/utils/site'

const cellsOn = useFeature('cells')
const rhythmOn = useFeature('rhythm')
const phraseCellsOn = useFeature('phraseCells')
const approachesOn = useFeature('approaches')
const patternsOn = useFeature('patterns')
const metronomeOn = useFeature('metronome')
const hearLineOn = useFeature('hearLine')

/** the ranking examples, from the engine as the sheets rank them */
const PENT_EXAMPLE = pentatonicChoices('Cmaj7', 'C Ionian', CONCERT).slice(0, 3)
const HEX_EXAMPLE = hexatonicChoices('Cmaj7', 'C Ionian', CONCERT)[0]?.name ?? ''

const RANGES = (Object.keys(INSTRUMENTS) as InstrumentName[]).map((n) => ({
  name: instrumentOption(n),
  range: `${noteName(INSTRUMENTS[n].range.lo)}–${noteName(INSTRUMENTS[n].range.hi)}`,
}))

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
  ...(metronomeOn ? [{ id: 'click', title: 'The click' }] : []),
]

const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD['how-it-decides']))
</script>
