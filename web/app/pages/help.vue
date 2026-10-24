<template>
  <div class="lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12">
    <!-- from lg: the text, and its index in a column beside it -->
    <article class="max-w-3xl space-y-12">
      <header class="space-y-3">
        <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">Help</p>
        <UiHeading>How it all works</UiHeading>
        <UiText>
          Nothing here is complicated to use (I hope), but a few things are tucked away. Here's the tour. If something's still unclear,
          <UiTextLink href="/contact">tell me</UiTextLink> and I'll fix the page (or the app).
        </UiText>
        <UiText>The app chooses scales and lines by rules; <UiTextLink href="/how-it-decides">How it decides</UiTextLink> says which.</UiText>
        <PageIndex :sections="SECTIONS" />
      </header>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="quick">
        <UiSubheading id="quick" class="scroll-mt-6">The short version</UiSubheading>
        <ol class="list-decimal space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
          <li>Pick a tune from the <UiTextLink href="/library">library</UiTextLink>.</li>
          <li>Choose your instrument from the <strong class="font-semibold text-zinc-950 dark:text-white">Instrument</strong> menu in the toolbar. The sheet is rewritten for it.</li>
          <li>Practice from the screen, hit <strong class="font-semibold text-zinc-950 dark:text-white">Focus</strong> to get rid of everything but the music, or print it.</li>
        </ol>
        <UiText>That's genuinely it. Everything below is for when you want more.</UiText>
      </section>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="sheets">
        <UiSubheading id="sheets" class="scroll-mt-6">The sheets</UiSubheading>
        <UiText>
          <strong class="font-semibold text-zinc-950 dark:text-white">Changes</strong> is the default view, where a chart opens: the tune as a lead sheet without
          the melody, in slashes, four bars a line, with each chord's Roman numeral and scale under it, and the key written
          in wherever it moves. It's the why behind the scales: <em>ii7 V7 Imaj7</em> in one key, then a
          <em>V7/ii</em> borrowing from the next. <strong class="font-semibold text-zinc-950 dark:text-white">Numerals</strong>
          and <strong class="font-semibold text-zinc-950 dark:text-white">Scales</strong> turn those rows on and off.
        </UiText>
        <UiText>
          <strong class="font-semibold text-zinc-950 dark:text-white">From 3rd</strong> and
          <strong class="font-semibold text-zinc-950 dark:text-white">From 7th</strong> put guide tones on the Changes staff in
          place of the slashes: one note a chord, the 3rd or 7th that tells you which chord you're on, moving as little as
          it can. Only one line shows at a time. Try singing or playing one line all the way through the tune; it's a great
          way to learn the changes. <DecisionLink id="guide.tones">How a line is built</DecisionLink> is in How it decides.
        </UiText>
        <UiText>
          <strong class="font-semibold text-zinc-950 dark:text-white">Scales</strong> is one staff per
          chord, with the scale that goes with it, in the order the tune runs. Each staff is labeled with where it is in
          the form, the chord and the scale. Practice works on this sheet.
        </UiText>
        <UiText>
          <strong class="font-semibold text-zinc-950 dark:text-white">Arpeggios</strong> is one staff per scale line, its
          chord's arpeggio: <strong class="font-semibold text-zinc-950 dark:text-white">7th Chord</strong> over two octaves,
          <strong class="font-semibold text-zinc-950 dark:text-white">Extended</strong> up through the 9th, 11th and 13th, or
          <strong class="font-semibold text-zinc-950 dark:text-white">Triad pairs</strong>, the chord's triad pair as six
          triads through their inversions, arpeggiated or as block chords. <DecisionLink id="hex.sheet">How the triads are
          ordered</DecisionLink> is in How it decides.
        </UiText>
        <UiText v-if="patternsOn">
          <strong class="font-semibold text-zinc-950 dark:text-white">Patterns</strong> runs a scale sequence over each scale line,
          one staff a line: 1 2 3 4, thirds, triads, stacked fourths and more, or one of your own, written as steps (<UiCode>+2 −1</UiCode> is up a third, back a step).
          <strong class="font-semibold text-zinc-950 dark:text-white">Scale</strong> steps through the scale and
          <strong class="font-semibold text-zinc-950 dark:text-white">Chord tones</strong> through the chord. Up, Down or Up &amp; down.
        </UiText>

        <UiSubheading id="guide-lines" :level="3" class="scroll-mt-6 pt-2">How a guide tone line is built</UiSubheading>
        <UiText>It's moved to <DecisionLink id="guide.tones">How it decides</DecisionLink>, with the rest of the app's choices.</UiText>
      </section>

      <section class="scroll-mt-6 space-y-6" aria-labelledby="controls">
        <UiSubheading id="controls" class="scroll-mt-6">The controls</UiSubheading>
        <UiText>The toolbar above the sheet, by what you're doing with it. On a phone they're under Controls.</UiText>

        <div class="space-y-3" data-controls-group>
          <UiSubheading :level="3">Reading it on your instrument</UiSubheading>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Instrument</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                Charts are always written in concert pitch, and the sheet is transposed for you: trumpet, clarinet, tenor
                and soprano in B♭, alto and bari in E♭, horn in F, and trombone, tuba and bass in bass clef. Piano, vibes,
                guitar and flute read concert; for oboe, violin or any other treble C instrument, choose Flute. Pick the pitch
                first (Concert, B♭, E♭, F or Bass), then your instrument in it. Piano until you choose; your choice is remembered. The Instrument button shows what's set (Piano · F3–E6) and opens a panel with the pitch, the instrument and Lowest and Highest note, the range every line keeps to.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">From key, From root, or From any note</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                <strong class="font-semibold">From key</strong>, where every chart starts, begins every scale on the tune's
                key note, written for your instrument. <strong class="font-semibold">From C</strong> (or any other note in
                the same list) starts every scale on that note instead. Both are sneaky good: the staves line up, so you
                can see exactly which notes change from chord to chord and which stay put.
                <strong class="font-semibold">From root</strong> starts every scale on its own chord's root: the D Dorian
                on D, the G Mixolydian on G.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Show: Intervals</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                On the Scales sheet, <strong class="font-semibold">Show</strong> holds Intervals. It labels each note against the chord's root (1, 9, ♭3, 11 and so on). Handy while you're learning what each
                note does. It starts on; switch it off if you don't need it (that's remembered too). It's on screen only,
                so printed sheets stay clean.
              </dd>
            </div>
          </dl>
          <UiText>Every line keeps to your instrument's range: <DecisionLink id="range.instrument">Written ranges</DecisionLink>.</UiText>
        </div>

        <div class="space-y-3" data-controls-group>
          <UiSubheading :level="3">Seeing the analysis</UiSubheading>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Analysis</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                On the Changes sheet, <strong class="font-semibold">Numerals</strong> and <strong class="font-semibold">Scales</strong>
                turn those rows on and off.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Line</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                <strong class="font-semibold">Off</strong>, <strong class="font-semibold">Guide Tones</strong> (From 3rd or
                From 7th) or <strong class="font-semibold">7th Chords</strong>, each chord's arpeggio in the pattern you
                choose, in quarters, eighths or sixteenths as the chords allow. A line's details (From 3rd or From 7th, the
                pattern, Approach) open from the <strong class="font-semibold">›</strong> beside it, Line options.
                <template v-if="approachesOn">
                  Under Guide Tones, <strong class="font-semibold">Approach</strong> leads into each chord's guide tone with a
                  short figure of eighths, played at the end of the chord before: a semitone below or above, an enclosure and
                  more. Under 7th Chords<template v-if="cellsOn"> and the cells</template>, with Superimpose off, it leads into each chord's first note the same way.
                </template>
              </dd>
            </div>
          </dl>
          <UiText>
            How each line picks its notes: <DecisionLink id="arp.line">the 7th Chords line</DecisionLink>, and
            <DecisionLink id="guide.tones">how a guide tone line is built</DecisionLink>.
          </UiText>
        </div>

        <div class="space-y-3" data-controls-group>
          <UiSubheading :level="3">Superimposing</UiSubheading>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Superimpose</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                Puts a row under the chords: <strong class="font-semibold">Off</strong>,
                <strong class="font-semibold">Pentatonic</strong> (each key area's minor pentatonic, or, ranked against
                Chord, each chord's, <strong class="font-semibold">Built on</strong> the degree you choose) or
                <strong class="font-semibold">Hexatonic</strong> (each chord's best triad pair from its scale, such as
                <UiCode>G/Am</UiCode> over Cmaj7, or, ranked against Key, one pair for each key area, its IV and V triads:
                <UiCode>F/G</UiCode> in C; <DecisionLink id="hex.key">how</DecisionLink>) or
                <strong class="font-semibold">Quartal</strong> (each chord's best stack of fourths from its scale, such as
                <UiCode>D G C F</UiCode> over Dm7, of three or four notes, perfect fourths only if you like, under Quartal
                options; <DecisionLink id="quartal.auto">how</DecisionLink>).
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Pentatonic, Triad pair and Quartal lines</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                While Superimpose is Pentatonic, the Line's <strong class="font-semibold">7th Chords</strong> becomes
                <strong class="font-semibold">Pentatonic</strong>: each chord's labeled pentatonic in four-note cells;
                <strong class="font-semibold">Leave out</strong> picks the note each cell drops. While it's Hexatonic, it
                becomes <strong class="font-semibold">Triad pair</strong>: each chord's labeled pair a triad at a time,
                from the note nearest the last, or in Walt Weiskopf's <strong class="font-semibold">Climb</strong> or
                <strong class="font-semibold">Arpeggios 1 3 5 8</strong> shape (<DecisionLink id="hex.line">how</DecisionLink>).
                While it's Quartal, it becomes <strong class="font-semibold">Quartal</strong>: each chord's labeled stack
                of fourths, whole, then its next stacks (<DecisionLink id="quartal.line">how</DecisionLink>). Each goes up,
                down or both by turns.
                <template v-if="cellsOn">
                  The 7th Chords pattern list also holds <strong class="font-semibold">Cells</strong>, after Randy Vincent's
                  <em>Building Solo Lines From Cells</em>: a four-note cell on each chord, two beats each, read through its scale.
                  <template v-if="phraseCellsOn">
                    <strong class="font-semibold">Order</strong> plays each cell as written, reversed, rotated or with its pairs
                    swapped. For a cell system, <strong class="font-semibold">Phrase</strong> is on: each cell is chosen to step into
                    the next cell's first note, across the chord change too. Turn it off to play the system as written.
                    The <strong class="font-semibold">Chromatic</strong> cells add a ♭9, a ♯5 or a passing tone over a dominant
                    (any other chord plays its arpeggio); <strong class="font-semibold">II–V chromatic</strong> plays 3 5 7 ♭9 on a
                    dominant and 1 3 5 7 on every other chord, as on the II of a II–V.
                  </template>
                </template>
              </dd>
            </div>
          </dl>
          <UiText>Which pentatonic and which pair: <DecisionLink id="pent.auto">how Auto chooses</DecisionLink>.</UiText>
        </div>

        <div class="space-y-3" data-controls-group>
          <UiSubheading :level="3">Choosing a level</UiSubheading>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Level</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                How fancy the scales get. <strong class="font-semibold">Basic</strong> leans on pentatonics,
                <strong class="font-semibold">Standard</strong> is the usual chord-scale for each chord,
                <strong class="font-semibold">Advanced</strong> reaches for bebop, Lydian and altered colors, and
                <strong class="font-semibold">Random</strong> deals every chord its own inside scale;
                <strong class="font-semibold">Shuffle</strong> deals a new hand. It's a view setting, like the instrument:
                it isn't saved into the chart, and a scale you picked yourself plays at every level.
              </dd>
            </div>
          </dl>
          <UiText>What each level reaches for: <DecisionLink id="scale.level">Scale levels</DecisionLink>.</UiText>
        </div>

        <div v-if="alternatesOn" class="space-y-3" data-controls-group>
          <UiSubheading id="alternates" :level="3" class="scroll-mt-6">Alternate changes</UiSubheading>
          <UiText>
            Some library charts carry a second set of changes for the bars where a common substitution is played (passing diminished
            chords, a bebop bridge's ii–Vs). The other bars are shared. A chart that has them shows <strong class="font-semibold text-zinc-950 dark:text-white">Changes</strong>
            in the toolbar above the sheet; a chart without them looks as it always did.
          </UiText>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Standard · Alternate</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                Which set is the main one. Every sheet plays it: the Changes, the Scales, the arpeggios and patterns, the guide tones, your
                picks and Practice. Each set keeps its own picks and Practice choices, so flipping back finds them as you left them. A sheet
                playing the alternates says <UiCode>Alternate changes</UiCode> under its title, printed too.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Other changes</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                On the Changes sheet, shows the other set's chords small above their bars, as a Real Book prints them. Flip the main set and the
                two swap places. Off hides them.
              </dd>
            </div>
          </dl>
          <UiText>
            Both settings are remembered per chart in this browser and travel in a share link.
          </UiText>
          <UiText>
            <strong class="font-semibold text-zinc-950 dark:text-white">Editing alternates.</strong> While you edit on a wide screen with
            Standard playing, a small line above the bars takes each bar's alternate. Click <UiCode>+ alt</UiCode> (or a bar's alternate)
            and type its chords: Tab moves to the next bar, Shift+Tab to the one before, Enter keeps it, Esc cancels. Leave it empty to
            remove the bar's alternate. A bar that goes on holding an earlier alternate shows that chord in italics. Chords the
            alternate set already plays there (the standard changes, or a chord held from before) aren't kept.
          </UiText>
          <UiText>
            With Changes set to Alternate, the big chords are the alternate set. Retype a bar both sets share and it becomes an alternate;
            retype it back and the alternate goes. Tapping a chord sets its scale and function as usual: on an alternate bar it sets the
            alternate's, on a shared bar the shared chord's. An alternate can't be held. Adding, deleting or splitting bars, pasting and
            new sections act on both sets. On a phone, switch to Alternate and tap a chord. A repeated section shows its alternates but
            can't be given new ones on the line: write the section out first.
          </UiText>
        </div>

        <div v-if="rhythmOn" class="space-y-3" data-controls-group>
          <UiSubheading id="rhythm" :level="3" class="scroll-mt-6">Rhythm</UiSubheading>
          <UiText>
            The sheets say which notes to play. A rhythm says when. On the Changes sheet with the Line off, the sheet stays a lead
            sheet, four slashes a bar, and the rhythm shows on a card over the first line: one cycle of it, in slashes with stems,
            beams, rests, ties and accents, to play over the changes. With a Line on, the Line plays in the rhythm. The Rhythm control
            shows the same card as you choose. It's a view setting, like the level: it isn't saved into the chart. It shows from the
            Intermediate interface up.
          </UiText>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Rhythm</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                In the Line's options, <strong class="font-semibold">Rhythm</strong> is Off or a rhythm from one of three families. With a Line on,
                the Line plays in the rhythm. The pulse is quarters, 8ths, triplets or 16ths.
              </dd>
            </div>
            <div>
              <dt id="rhythm-cycle" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Units</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                After Ed Saindon's <em>Exploration in Rhythm, Vol. 1: Rhythmic Phrasing in Improvisation</em> (pp. 7–8). A unit is a group of 2 to 7 pulses, repeated from the first beat and ignoring
                barlines. <strong class="font-semibold">In</strong> sets the group, and <strong class="font-semibold">Variation</strong>
                shapes it: with accents, with rests, rest last, syncopated or tied. Saindon's bracket under the staff marks the
                unit's first statement, and again the first at each bar where it is back on one. The caption names the cycle, for example <UiCode>back on one every 5 bars</UiCode>.
                That counts the unit and the bar in pulses: 8ths in 5 over 4/4 is back on one every 5 bars, 8ths in 4 over 3/4 every 2.
                Where the time signature changes, the caption lists the bars.
              </dd>
            </div>
            <div v-if="rhythmGearsOn">
              <dt id="rhythm-tuplets" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Tuplet pulses</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                From the Everything interface, Units also come at six tuplet pulses, after Ed Saindon's <em>Rhythmic Patterns</em> (ch. 10) and Jerry
                Bergonzi's <em>Inside Improvisation Vol. 4</em> (ch. 24): quarter-note triplets (3 in the time of 2 beats), quarter-note quintuplets
                (5 in 4 beats), 8th-note quintuplets (5 in 2 beats), 16th quintuplets (5 in a beat), sextuplets (6 in a beat) and septuplets (7 in a beat).
                <strong class="font-semibold">Your rhythm…</strong> takes them too, as <UiCode>4t:</UiCode>, <UiCode>4q:</UiCode>, <UiCode>8q:</UiCode>,
                <UiCode>16q:</UiCode>, <UiCode>16t:</UiCode> and <UiCode>16s:</UiCode>. Each bar draws its tuplets with their number over the bracket, and
                a note held through whole tuplets merges into one plain note. A tuplet never crosses a barline, so a bar that doesn't hold a whole number
                of its tuplets (2 beats each for quarter-note triplets and 8th-note quintuplets, 4 for quarter-note quintuplets) plays in plain quarters,
                or plain 8ths for 8th-note quintuplets: a 3/4 bar under quarter-note triplets, say, or every bar of a 3/4 tune under quarter-note
                quintuplets. The unit keeps counting through that bar.
              </dd>
            </div>
            <div v-if="rhythmGearsOn">
              <dt id="rhythm-groups" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Mixed phrasing</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                From the Everything interface, a unit on the Changes can change its grouping as the tune goes, after Ed Saindon's mixed phrasing
                (<em>Rhythmic Patterns</em>, p. 12) and Jerry Bergonzi's groupings (<em>Inside Improvisation Vol. 4</em>, ch. 14, “Mixing groups”, p. 64). In
                <strong class="font-semibold">Line options</strong>, <strong class="font-semibold">Groups</strong> is One (the unit's own), Up (3 4 5 6 7),
                Down (7 6 5 4 3) or Your list… (numbers 2 to 7, separated by spaces), and <strong class="font-semibold">Step</strong> says when the next
                grouping comes: at each section, at each change of key area, or every 2, 4 or 8 bars. A list shorter than the form starts over. Each
                step starts fresh on its first bar's beat 1: a statement still running there is cut, with no tie, and a Line's pick-ups don't reach back
                over it. An intro or an ending plays the first grouping. A circled number (③) over a step's first note shows its grouping, the caption
                names the path, and with the Line off a card a step over the first line shows each grouping the form plays, named the same way, and the path is kept with the chart in this browser and goes in a share link. Your rhythm…, Runs and Cards keep theirs.
              </dd>
            </div>
            <div v-if="rhythmGearsOn">
              <dt id="rhythm-gears" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Gears</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                From the Everything interface, a unit or Your rhythm… on the Changes can change its pulse as the tune goes, after Jerry Bergonzi's
                gears (<em>Inside Improvisation Vol. 4</em>, chs. 22–26): the same cells, played faster or slower. In
                <strong class="font-semibold">Line options</strong>, <strong class="font-semibold">Gears</strong> is One (the rhythm's own pulse),
                Up the gears (quarter-note triplets, 8ths, triplets, 16ths, sextuplets: Bergonzi's five), Down the gears (the same, from sextuplets)
                or Your list… (pulses as Your rhythm… spells them, <UiCode>8 8t 16</UiCode>, separated by spaces). It takes the same
                <strong class="font-semibold">Step</strong> as Groups, and with both on each keeps its own place in its list. Each step starts fresh, as
                in mixed phrasing. The pulse's name in italics (<em>Triplets</em>) over a step's first note shows where it changes, after the circled
                number when the grouping changes too. Contraction and expansion (ch. 26) is a gear path by 2 bars: Your list… <UiCode>8 8t 16</UiCode>,
                Every 2 bars, say, squeezes the same unit into less time each step. Runs and Cards keep their pulse.
              </dd>
            </div>
            <div v-if="rhythmGearsOn">
              <dt id="rhythm-feel" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Feel</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                From the Everything interface, <strong class="font-semibold">Feel</strong> in <strong class="font-semibold">Line options</strong> groups
                the Changes' beats in 4, in 2 (half time) or in 1, after Jerry Bergonzi's feels (<em>Inside Improvisation Vol. 4</em>, ch. 30) and Hal
                Galper's half time. In 2 the slashes are half notes (a dotted half in 3/4, a dotted half and a half in 5/4) and 8ths beam by the
                group; the target dots stay on 1 and 3. In 1 a slash, and a beam, is the bar long, tied where it's longer than a whole note, and beat 1 is
                the only target. It changes only how the sheet is written: the rhythm plays the same, and units keep their own beams. It shows with or
                without a rhythm, "in 2" or "in 1" in italics over the first bar, and "feel in 2" in the caption with a rhythm; it is kept in this
                browser and goes in a share link. The Scales and Arpeggios sheets keep the beat.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Runs</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                After Jerry Bergonzi's <em>Inside Improvisation, Vol. 4: Melodic Rhythms</em> (consecutive 8ths, pp. 29–50). A run is a few attacks in a row,
                the same in every bar. <strong class="font-semibold">Attacks</strong> says how many (2 to 7) and
                <strong class="font-semibold">From</strong> where in the bar the first one lands, by the count: 1, the and of 1, 2, and so
                on. A run that reaches past the barline finishes in the next bar. <strong class="font-semibold">Cards</strong> are the
                simplest per-bar rhythms: Downbeats, Upbeats and Half notes.
              </dd>
            </div>
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Your rhythm…</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                Type your own. Start with the pulse, <UiCode>4:</UiCode>, <UiCode>8:</UiCode>, <UiCode>8t:</UiCode> or <UiCode>16:</UiCode>,
                then one character for each pulse: <UiCode>x</UiCode> plays, <UiCode>.</UiCode> rests, <UiCode>_</UiCode> holds the note
                before it, and <UiCode>&gt;</UiCode> before an <UiCode>x</UiCode> accents it. Spaces and <UiCode>|</UiCode> are ignored.
                <UiCode>8: &gt;xx.x_</UiCode> is an accented attack, one more, a rest, an attack held a pulse more. It repeats like a unit.
                If it doesn't fit these rules the control says so and plays Off.
              </dd>
            </div>
            <div>
              <dt id="rhythm-pour" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Rhythm on a Line</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                With a Line on, the Line's notes are poured into the rhythm: one note an attack, rests skipped, a tie holding the note before it.
                A chord with more notes than attacks is cut off at its end. With fewer, its line starts the next cell or turns back.
                Poured Lines print one line fewer per page.
              </dd>
            </div>
            <div>
              <dt id="rhythm-pickups" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Start</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                In the Line's options (Everything interface), <strong class="font-semibold">Start</strong> is On the beat or a 1-, 2- or 3-note pick-up.
                It follows Hal Galper's <em>Forward Motion: From Bach to Bebop</em> (pp. 169–172). Each chord's target, its first note on a beat, is struck even where the
                rhythm rests, and so is each pick-up note before it. The pick-up's notes are the chord before's; after a rest they are the scale's
                notes just below the target, and a note outside your range rests. The sheet's first bar has no pick-up, and a 2nd ending starts on its beat.
              </dd>
            </div>
            <div>
              <dt id="rhythm-anticipate" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Timing</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                Also Everything. <strong class="font-semibold">Timing</strong> begins each chord's notes early (Anticipate) or late (Resolve late), after
                Jerry Bergonzi's <em>Inside Improvisation, Vol. 4: Melodic Rhythms</em> (p. 119). The chord symbols stay put. With Target beats on, the target
                color is judged against the chart's chord at that beat, so under Anticipate or Resolve late a note can be judged against the chord before or after the one it plays.
              </dd>
            </div>
            <div>
              <dt id="rhythm-restate" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Restate</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                In the Line's options (Intermediate), shown with Guide Tones. Guide Tones hold each chord's note unless <strong class="font-semibold">Restate</strong> is on,
                which plays it again on every attack of the rhythm.
              </dd>
            </div>
            <div>
              <dt id="rhythm-targets" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Target beats</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                In the Changes sheet's Analysis group, a toggle that puts a dot over each strong beat of a bar: 1 in 2/4 and 3/4, 1 and 3 in 4/4,
                1 and 4 in 5/4 and 6/4, 1 and 5 in 7/4. It follows Hal Galper's <em>Forward Motion: From Bach to Bebop</em> (pp. 47–49, 67).
                A line releases on the on-beats and builds tension on the off-beats, so aim a chord tone at each dot. The dots show on the slashes and on a rhythm alike.
              </dd>
            </div>
            <div>
              <dt id="rhythm-target-tones" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Target tones</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                On a Line with Target beats on, a chord tone on a dot is lit and any other note on a dot is gray (Galper, pp. 47–49). Nothing moves a note onto a dot. A screen reader hears the target beats and the notes on them, each one that isn't a chord tone named so.
              </dd>
            </div>
            <div v-if="rhythmSheetsOn">
              <dt id="rhythm-card" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Rhythm card</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                On the Scales sheet, the <strong class="font-semibold">Rhythm</strong> group puts a card under each staff: the rhythm as slashes on one line,
                with its accents, triplets and Saindon's bracket. The staff says which notes and the card says when; the whole notes stay as they are,
                so play the scale in the card's rhythm. The card is one cycle long, the bars it takes to come back on one, up to four bars. A longer
                cycle ends in <UiCode>…</UiCode> and carries on the same way. A bar is a quarter of the staff's width. The staff and its card take
                the time signature of the bar that holds the staff's first chord (4/4 where the chart has none), shown on both. The page's subtitle names
                the rhythm. A sheet with cards prints eight staves a page.
              </dd>
            </div>
            <div v-if="rhythmSheetsOn">
              <dt id="notes-per-bar" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Notes per bar</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                Beside the Rhythm on the Scales sheet, <strong class="font-semibold">Notes per bar</strong> rewrites each staff as a run, after Jerry Bergonzi's
                <em>Inside Improvisation Vol. 4</em> (ch. 1): the scale up from its first note to the octave above and back down, in bars of that many notes
                (a seven-note scale is 15 notes). The bars are even: a note the bar long for 1; one value for all of them where it fits the bar (four quarters in 4/4,
                two dotted quarters in 3/4); otherwise a tuplet of the longest value that fits, such as five quarters in the time of four. The last bar's spare notes
                rest. With a Rhythm too, each bar plays the rhythm's first notes up to that many, and rests the rest, so the rhythm keeps its own values and accents.
                Practice lights a note each time the run plays it, and the intervals follow the run. The time signature is the staff's, as for the rhythm card, and the
                page's subtitle names the number. <em>Whole notes</em> is the staff as it was. A sheet with runs prints eight staves a page.
              </dd>
            </div>
            <div v-if="rhythmSheetsOn">
              <dt id="rhythm-arpeggios" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Rhythm on the Arpeggios</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                On the Arpeggios sheet, the <strong class="font-semibold">Rhythm</strong> group pours each arpeggio into the rhythm: the same notes in the same
                order, each note an attack, in bars with the time signature (the staff's, as for the rhythm card). Rests and ties come from the rhythm, its beams
                replace the arpeggio's, and its accents and triplets draw; Saindon's bracket doesn't. The last note's bar rests after it. The page's subtitle
                names the rhythm, and a sheet with a rhythm prints eleven staves a page. Triad pairs' <em>Block</em> plays chords, so it takes no rhythm and
                the group hides there.
              </dd>
            </div>
            <div v-if="rhythmSheetsOn">
              <dt id="rhythm-grouping" class="scroll-mt-6 font-semibold text-zinc-950 dark:text-white">Grouping</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                To play an arpeggio grouped in 3, 4, 5, 6 or 7, choose the Rhythm <em>8ths in N, with accents</em>: every 8th plays, beamed in groups of N
                across the barlines, the first of each group accented. Grouping in N is that rhythm, after Ed Saindon's <em>Rhythmic Patterns</em> (p. 12)
                and Jerry Bergonzi's <em>Inside Improvisation Vol. 4</em> (ch. 32).
              </dd>
            </div>
          </dl>
        </div>

        <div class="space-y-3" data-controls-group>
          <UiSubheading :level="3">How much shows</UiSubheading>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Interface</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                In <strong class="font-semibold">⋯ More actions</strong>, it chooses how many controls show.
                <strong class="font-semibold">Essentials</strong>: the sheet, instrument, transposing, printing, sharing and
                editing chords, bars and sections. <strong class="font-semibold">Intermediate</strong> adds the scale level,
                the analysis rows, lines, scale spelling, Practice, repeats and endings, choosing a chord's scale, and a short list of
                ready-made rhythms. <strong class="font-semibold">Everything</strong> adds every rhythm and its options (grouping,
                variation, runs, your own), pentatonics, chord picks, functions and key changes, and the
                chart's source. A sheet set up with controls you can't see says so above it, with Show controls and Reset.
              </dd>
            </div>
          </dl>
        </div>

        <div v-if="metronomeOn" class="space-y-3" data-controls-group>
          <UiSubheading :level="3">Practicing with a click</UiSubheading>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Click</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                The note icon beside Print shows a metronome along the bottom of the window (in focus mode, in the bar at the top), so you can play the
                tune from the sheet without another app. It's set to the chart's time signature, with a tempo and a feel read
                from its style (<DecisionLink id="click.tempo">how</DecisionLink>). <strong class="font-semibold">Start</strong>
                plays it, and <kbd>Space</kbd> starts and stops it from anywhere on the page.
                <strong class="font-semibold">−</strong> and <strong class="font-semibold">+</strong> change the tempo by one
                (with Shift, by five), as do the arrow keys in the tempo, or type it, 40 to 300; <strong class="font-semibold">Tap</strong> takes it from a few
                taps of the beat. The feel is what plays between the beats: <strong class="font-semibold">Quarters</strong>, the
                beats alone; <strong class="font-semibold">Swing</strong>, the skip note of swung eighths; or
                <strong class="font-semibold">Straight</strong>, even eighths. Under <strong class="font-semibold">⋯</strong>: a
                count-in of one or two bars; <strong class="font-semibold">Click on</strong>, the beats it sounds (every beat, 2 and 4, 1 and 3,
                3 only, 4 only, or the and of 2 and 4, after Bergonzi; <DecisionLink id="click.pattern">how it starts</DecisionLink>); a hat on 2 and 4 in 4/4; and the sound: Wood or Beep, synthesized, or Stick, a recorded drumstick (a sound file on this site, loaded when you start; until it loads, or if it can't, Wood plays). The chevron folds it to
                Start, the tempo and the beat, playing on, to leave a phone's screen to the music. The
                chart remembers its tempo, feel and Click on. A chart that changes time signature partway plays the one it starts in.
                On an iPhone or iPad the sound stops when the screen locks.
              </dd>
            </div>
            <div v-if="hearLineOn">
              <dt class="font-semibold text-zinc-950 dark:text-white">Hear line</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                With a Line on the Changes sheet, <strong class="font-semibold">Hear line</strong> on the click plays it with the
                click: the notes on the sheet, in their rhythm, at concert pitch (<DecisionLink id="hear.pitch">where</DecisionLink>),
                in the form's order, repeats, endings and D.S. too (<DecisionLink id="hear.form">how</DecisionLink>), then from the
                top again. With the click on Swing, its 8ths swing, as far as the Swing dial under the click's ⋯ says
                (<DecisionLink id="hear.swing">how</DecisionLink>).
                Listen first, then play it with the sound, then turn it off and play it alone.
                With a rhythm on the sheet, <strong class="font-semibold">Hear rhythm</strong> (under the click's ⋯) taps it on a rim
                with the click, with the Line or without one (<DecisionLink id="hear.rhythm">what it taps</DecisionLink>).
              </dd>
            </div>
            <div v-if="hearLineOn">
              <dt class="font-semibold text-zinc-950 dark:text-white">Play a staff</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                On the Scales and Arpeggios sheets, the <strong class="font-semibold">Play</strong> button by each staff's
                label sounds it at the click's tempo: a scale up and down (with Practice on, only the notes you picked), an
                arpeggio as drawn (<DecisionLink id="hear.play">how</DecisionLink>). On the Changes sheet, each pentatonic on a
                label's ladder has one too: it plays that minor pentatonic up to its octave and back. With the click running it
                comes in on the next bar. Press it again to stop.
                Both play a recorded piano, a set of sound files on this site, loaded the first time you play and kept for
                offline use; until it loads, or if it can't, a plain synthesized tone plays instead. Nothing is recorded or sent.
              </dd>
            </div>
            <div v-if="harmonyOn">
              <dt class="font-semibold text-zinc-950 dark:text-white">Piano and Bass</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                With the Changes sheet, <strong class="font-semibold">Piano</strong> and <strong class="font-semibold">Bass</strong>
                (under the click's ⋯) play the chart's changes with the click: a piano's voicings, the tensions as the sheet's
                scales have them at its level, and a bass on the roots, or roots and 5ths in two
                (<DecisionLink id="hear.harmony">how</DecisionLink>). A transposed chart plays in its new key. Practice over
                them, with Hear line or without it.
              </dd>
            </div>
            <div v-if="grooveOn.swing || grooveOn.ballad || grooveOn.bossa">
              <dt class="font-semibold text-zinc-950 dark:text-white">Groove and Drums</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                A chart offers its style's groove under the click's ⋯, and <strong class="font-semibold">Drums</strong> with it.
                <template v-if="grooveOn.swing">A swing style's <strong class="font-semibold">Swing groove</strong>: the piano comps, the bass walks, the drums play a ride and hi-hat
                (<DecisionLink id="groove.swing">how</DecisionLink>).</template>
                <template v-if="grooveOn.ballad">A ballad's <strong class="font-semibold">Ballad groove</strong>: a held piano, a bass in two, brushes
                (<DecisionLink id="groove.ballad">how</DecisionLink>).</template>
                <template v-if="grooveOn.bossa">A bossa or Latin style's <strong class="font-semibold">Bossa groove</strong>: a syncopated piano, a bossa bass, a cross-stick
                (<DecisionLink id="groove.bossa">how</DecisionLink>).</template>
                The style also sets how far the 8ths swing
                (<DecisionLink id="groove.style">how</DecisionLink>). The drums are recorded too, loaded the first time.
              </dd>
            </div>
            <div v-if="mixerOn">
              <dt class="font-semibold text-zinc-950 dark:text-white">Mix</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                Under the click's ⋯, each sound playing (the click, the Line, the rhythm, the piano, the bass, the drums) has a
                level and a <strong class="font-semibold">Mute</strong>. With Piano or Bass on, <strong class="font-semibold">Mix</strong>
                sets the band at once: Band, everyone; Piano duo or Bass duo, you and the one; No piano or No bass, the band
                without the part you play. A muted part keeps its level and settings for when it's back. Remembered in this browser.
              </dd>
            </div>
            <div v-if="practiceToolsOn">
              <dt class="font-semibold text-zinc-950 dark:text-white">All keys and Ramp</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                With the Changes sheet, under the click's ⋯: <strong class="font-semibold">All keys</strong> plays each time
                through the form in the next key, up a 4th (round the cycle) or up a half step, so twelve choruses visit every
                key; the Line, the piano and the bass move, the drums and the click don't, and the sheet stays as written. The bar
                says how far the chorus is from the written key, never more than a tritone. <strong class="font-semibold">Ramp</strong>
                plays each chorus 2, 4 or 8 beats a minute faster; Stop puts the tempo back.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="practice">
        <UiSubheading id="practice" class="scroll-mt-6">Practice: improvise with fewer notes</UiSubheading>
        <UiText>
          On the Scales sheet, the <strong class="font-semibold text-zinc-950 dark:text-white">Practice</strong> panel
          lets you pick a handful of notes from each scale. Those stay bold and the rest fade back, on screen and in
          print. Improvising with just the guide tones through a tune is harder (and more useful) than it sounds. The
          panel's <strong class="font-semibold text-zinc-950 dark:text-white">How it works</strong> opens a short
          reminder of what the boxes and presets do.
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
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Pentatonic</strong> lights a minor pentatonic over
            each scale: the notes they share, and the pentatonic's others added to the staff in a second color. <strong class="font-semibold">Built on</strong> picks the degree of each chord
            it starts from: on 2 over Cmaj7 is Dm pentatonic, and over G7 it's Am. <strong class="font-semibold">Auto</strong>
            picks the one that shares the most, nearest the chord's root (<DecisionLink id="pent.auto">how</DecisionLink>). The caption under each chord names it and
            counts the notes it shares (<UiCode>Dm pent · 5 shared</UiCode>). {{ PENT_INSIDE_HELP }}
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Hexatonic</strong> lights two triads from each
            scale, six notes, after Gary Campbell's <em>Triad Pairs for Jazz</em>. <strong class="font-semibold">Pair</strong>
            <em>n</em> is the triads on degrees <em>n</em> and <em>n</em> + 1 of each staff's scale; on a seven-note scale
            that leaves out degree <em>n</em> − 1 (Pair 1 leaves out the 7th). Pair 5 over C major is G/Am, without the F. <strong class="font-semibold">Auto</strong>
            picks the pair that covers the most chord tones (<DecisionLink id="hex.auto">how</DecisionLink>); ranked against
            <strong class="font-semibold">Key</strong>, each staff takes its key area's IV and V triads where its scale holds
            them, and the caption says <em>off key</em> where it doesn't. The grouping splits the six notes in two (the two triads,
            chord tones and color, a pentatonic and one more, or the lowest three and highest three), tinted apart; the
            caption under each chord names the pair.
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Quartal</strong> lights a stack of fourths from each
            seven-note scale: its notes three steps apart, <strong class="font-semibold">Built on</strong> the degree you
            choose, three or four <strong class="font-semibold">Notes</strong>. <strong class="font-semibold">Auto</strong>
            picks the stack that holds the guide tones without an avoid note (<DecisionLink id="quartal.auto">how</DecisionLink>):
            <UiCode>F B E A</UiCode> over G7. A stack may hold one augmented fourth;
            <strong class="font-semibold">Perfect only</strong> allows none. The caption names the stack
            (<UiCode>D G C F · 4ths</UiCode>).
          </li>
          <li>
            Click a chord's pentatonic or triad pair (Changes) or a staff's caption (Scales) to pick another for that chord; the list runs from <DecisionLink id="pick.order">inside to outside</DecisionLink>. A pick on the Scales sheet sets every bar that staff covers. <strong class="font-semibold text-zinc-950 dark:text-white">Sheet’s choice</strong> undoes it; <strong class="font-semibold text-zinc-950 dark:text-white">⋯ More actions → Reset chord picks</strong> undoes them all.
            Picks are the same on both sheets, survive a change of Built on or Pair, and go with a share link.
          </li>
          <li>Tick or untick a box while a preset's on and you get your own mix, starting from what the preset showed.</li>
          <li><strong class="font-semibold text-zinc-950 dark:text-white">Clear</strong> turns it all off.</li>
          <li>Your ticks are remembered for each library chart, in this browser, separately for From root and from a note.</li>
        </ul>
      </section>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="editing">
        <UiSubheading id="editing" class="scroll-mt-6">Editing a chart</UiSubheading>
        <UiText>
          You can change anything in a chart: a reharmonization, a different scale choice, a bridge you play differently.
          Press <strong class="font-semibold text-zinc-950 dark:text-white">Edit</strong>, next to the title, and the chart opens as bars, four to a line, always in
          concert pitch; <strong class="font-semibold text-zinc-950 dark:text-white">Done</strong> puts it away. The sheet keeps up as you go, and ⌘Z (Ctrl+Z off a Mac)
          undoes.
        </UiText>

        <UiSubheading :level="3" class="pt-2">The bars</UiSubheading>
        <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
          <li>Pick a chord and type to replace it. Space adds a second chord to the bar, Tab and the arrow keys move on, <UiCode>%</UiCode> repeats the bar before, and ⌫ clears it.</li>
          <li>
            Beside the bars, the chord's scales: the usual choice first, then the others that fit, then an
            <strong class="font-semibold">Outside</strong> group for when you want some tension to resolve. Type in the
            search box for any scale at all. Under them, its function (a Roman numeral such as <UiCode>V7/ii</UiCode>,
            which tells the rules what the chord does; <UiTextLink href="/functions#writing">Functions and rules</UiTextLink>
            shows the scale each gives) and why I chose that scale.
          </li>
          <li>The bar's own buttons add a bar before or after, delete it, start a new section or a key change there, and add endings, a segno, a coda or a jump.</li>
          <li>Under the bars: <strong class="font-semibold text-zinc-950 dark:text-white">+ Bar</strong>, <strong class="font-semibold text-zinc-950 dark:text-white">+ Section…</strong>, <strong class="font-semibold text-zinc-950 dark:text-white">Repeat a section…</strong> and <strong class="font-semibold text-zinc-950 dark:text-white">Paste bars…</strong>. <strong class="font-semibold text-zinc-950 dark:text-white">Numerals &amp; scales</strong> shows each chord's numeral and scale under it.</li>
          <li>If a chord comes up amber, I don't recognize it. Pick a scale for it and it'll draw (<DecisionLink id="scale.unknown">what happens to it until then</DecisionLink>).</li>
          <li>With the editor open, you can also tap a chord on the Changes sheet to change it there. On a phone that's the way to edit: the bars need a bigger screen.</li>
        </ul>

        <UiSubheading id="source" :level="3" class="scroll-mt-6 pt-2">The source</UiSubheading>
        <UiText>
          Under the <strong class="font-semibold text-zinc-950 dark:text-white">⋯</strong> menu, <strong class="font-semibold text-zinc-950 dark:text-white">Show source</strong> opens the chart as plain
          text, the same chart as the bars (edit either), and lists anything I can't make sense of under it, with the line number.
          <UiTextLink href="/chart-format">Chart format</UiTextLink> has every line it reads, with an example.
        </UiText>

        <UiSubheading :level="3" class="pt-2">Transposing</UiSubheading>
        <UiText>
          <strong class="font-semibold text-zinc-950 dark:text-white">Transpose…</strong>, beside Edit, moves the whole chart to another
          key, so you can work on a tune in all twelve. It spells things sensibly for the new key (D♭–7 G♭7 in B♭, not
          C♯–7 F♯7: <DecisionLink id="spell.transpose">why</DecisionLink>). To undo it, transpose back. That's different from the Instrument setting, which only changes how the
          sheet is written.
        </UiText>

      </section>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="saving">
        <UiSubheading id="saving" class="scroll-mt-6">Saving your work</UiSubheading>
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
            <strong class="font-semibold text-zinc-950 dark:text-white">Versions:</strong> when a tune has more than one
            chart, like Summertime and its Jazz Mind Accelerator version, the <strong class="font-semibold">Version</strong>
            menu above the sheet switches between them. Your own charts of the tune (a copy, or a chart with its title)
            are listed there too, under Mine; add a <UiCode>version:</UiCode> line to give yours a name.
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Download</strong> saves the chart as a plain
            <UiCode>.txt</UiCode> file you can keep anywhere. <strong class="font-semibold">Open chart…</strong> in the
            library (or dropping the file on it) brings it back.<template v-if="ireal"> It also opens an iReal Pro export (.html), and <strong class="font-semibold">Import iReal link…</strong> takes a song or playlist link: the chords come across in concert pitch, and it lists anything it leaves out.</template>
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Share</strong> makes a link with the whole chart
            packed inside, plus your instrument, where the scales start, and practice picks. Open it on your phone, or
            send it to your bandmates. Nothing is uploaded: the chart lives in the link itself.
          </li>
        </ul>
        <UiText>
          <strong class="font-semibold text-zinc-950 dark:text-white">One catch:</strong> My charts lives in this
          browser only. Another browser or device won't see it, and clearing this site's data wipes it. For anything
          you'd hate to lose, download it.
        </UiText>

        <template v-if="backupOn">
          <UiSubheading id="backup" :level="3" class="scroll-mt-6 pt-2">Back up and restore</UiSubheading>
          <UiText>
            <strong class="font-semibold">Backup → Back up…</strong> in the library saves everything this browser keeps
            in one file: My charts, each chart's practice picks, level and chord picks (the alternate changes' too, and which set you play), the same for library tunes, and
            your preferences (instrument, range, theme, how the sheets look). Undo history stays behind<template v-if="metronomeOn">, and so does each chart's click tempo</template>.
            <strong class="font-semibold">Restore from backup…</strong> (or <strong class="font-semibold">Open chart…</strong>,
            or dropping the file on the library) brings it into another browser. It shows what's new, what's already
            there and what differs before anything changes; nothing of yours is replaced unless you choose it.
          </UiText>
          <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
            <li id="backup-conflicts" class="scroll-mt-6">
              <strong class="font-semibold text-zinc-950 dark:text-white">A chart that differs from yours:</strong>
              <strong class="font-semibold">Keep both</strong> unless you choose otherwise. The backup's comes in beside
              yours with “(imported)” on its title; an edited library tune comes in as a copy, so both show in its
              Version menu. <strong class="font-semibold">Use imported</strong> replaces yours, its picks with it, and
              clears its undo history; <strong class="font-semibold">Keep mine</strong> skips it.
            </li>
            <li id="backup-library" class="scroll-mt-6">
              <strong class="font-semibold text-zinc-950 dark:text-white">A library tune's picks and level:</strong>
              yours are kept unless you choose <strong class="font-semibold">Use imported</strong>.
            </li>
            <li id="backup-preferences" class="scroll-mt-6">
              <strong class="font-semibold text-zinc-950 dark:text-white">Preferences:</strong> used straight away only in a
              browser that has never opened this site; anywhere else, only if you tick the box. Reload to see them.
            </li>
          </ul>
          <UiText>
            If the browser's storage fills up partway, it stops and says what was restored and what wasn't; each chart
            comes in whole or not at all. My charts holds at most 200.
          </UiText>
        </template>
      </section>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="printing">
        <UiSubheading id="printing" class="scroll-mt-6">Printing and Focus</UiSubheading>
        <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Print</strong> gives you clean letter
            pages, black on white whatever mode you're in: twelve staves a page for scales, eight lines a page for the
            changes (fewer with guide tones on). The dashed lines on screen show where each page starts. To get a PDF, pick "Save as PDF" in your
            browser's print dialog.
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Focus</strong> hides everything but the sheet
            music, for practicing from a tablet or laptop on the stand. Its pages are fitted to the screen, so the sheet's
            labels are plain text there: pick a scale or open a chord's Why before you go in. Press
            <kbd class="font-sans font-semibold">Esc</kbd> or <strong class="font-semibold">Exit focus</strong> to come back.
          </li>
        </ul>
      </section>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="odds">
        <UiSubheading id="odds" class="scroll-mt-6">Odds and ends</UiSubheading>
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
          <li>
            Wondering why the app chose something? <UiTextLink href="/how-it-decides">How it decides</UiTextLink> says, for
            every choice it makes. For one chord's scale, click its numeral or scale on the Changes sheet: the note says why and
            names the rule, and <UiTextLink href="/functions#rules">Functions and rules</UiTextLink> lists them all. If
            you'd choose differently, <strong class="font-semibold text-zinc-950 dark:text-white">Report issue</strong>
            in that note collects the details for the contact form.
          </li>
          <li>What's new? The <UiTextLink href="/release-notes">release notes</UiTextLink> list every change, newest first.</li>
          <li>It works on a phone, but the staves are small. A tablet or a laptop is nicer.</li>
          <li v-if="offline">
            It works offline too. Add it to your home screen (on an iPad or iPhone, Share → Add to Home Screen) and it
            opens like an app. Once you've opened the site, every tune in the library is there without a connection.
          </li>
        </ul>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta } from '~/utils/site'
import { PENT_INSIDE_HELP } from '~/utils/pentatonics'

const offline = useFeature('offline')
const patternsOn = useFeature('patterns')
const cellsOn = useFeature('cells')
const alternatesOn = useFeature('alternates')
const phraseCellsOn = useFeature('phraseCells')
const approachesOn = useFeature('approaches')
const ireal = useFeature('ireal')
const backupOn = useFeature('backup')
const metronomeOn = useFeature('metronome')
const hearLineOn = useFeature('hearLine')
const harmonyOn = hearLineOn && useFeature('harmony')
const mixerOn = hearLineOn && useFeature('mixer')
const practiceToolsOn = hearLineOn && useFeature('practiceTools')
const grooveOn = { swing: harmonyOn && useFeature('grooveSwing'), ballad: harmonyOn && useFeature('grooveBallad'), bossa: harmonyOn && useFeature('grooveBossa') }
const rhythmOn = useFeature('rhythm')
const rhythmSheetsOn = useFeature('rhythmSheets')
const rhythmGearsOn = useFeature('rhythmGears')
const SECTIONS = [
  { id: 'quick', title: 'The short version' },
  { id: 'sheets', title: 'The sheets' },
  { id: 'controls', title: 'The controls' },
  { id: 'practice', title: 'Practice' },
  { id: 'editing', title: 'Editing a chart' },
  { id: 'saving', title: 'Saving your work' },
  { id: 'printing', title: 'Printing and Focus' },
  { id: 'odds', title: 'Odds and ends' },
]

const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD.help))
</script>
