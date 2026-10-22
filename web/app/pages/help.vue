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
          <li>Practise from the screen, hit <strong class="font-semibold text-zinc-950 dark:text-white">Focus</strong> to get rid of everything but the music, or print it.</li>
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
          chord, with the scale that goes with it, in the order the tune runs. Each staff is labelled with where it is in
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
                <strong class="font-semibold">Pentatonic</strong>: each chord's labelled pentatonic in four-note cells;
                <strong class="font-semibold">Leave out</strong> picks the note each cell drops. While it's Hexatonic, it
                becomes <strong class="font-semibold">Triad pair</strong>: each chord's labelled pair a triad at a time,
                from the note nearest the last, or in Walt Weiskopf's <strong class="font-semibold">Climb</strong> or
                <strong class="font-semibold">Arpeggios 1 3 5 8</strong> shape (<DecisionLink id="hex.line">how</DecisionLink>).
                While it's Quartal, it becomes <strong class="font-semibold">Quartal</strong>: each chord's labelled stack
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
                <strong class="font-semibold">Advanced</strong> reaches for bebop, Lydian and altered colours, and
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

        <div class="space-y-3" data-controls-group>
          <UiSubheading :level="3">How much shows</UiSubheading>
          <dl class="space-y-4 text-base/6 sm:text-sm/6">
            <div>
              <dt class="font-semibold text-zinc-950 dark:text-white">Interface</dt>
              <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
                In <strong class="font-semibold">⋯ More actions</strong>, it chooses how many controls show.
                <strong class="font-semibold">Essentials</strong>: the sheet, instrument, transposing, printing, sharing and
                editing chords, bars and sections. <strong class="font-semibold">Intermediate</strong> adds the scale level,
                the analysis rows, lines, scale spelling, Practice, repeats and endings, and choosing a chord's scale.
                <strong class="font-semibold">Everything</strong> adds pentatonics, chord picks, functions and key changes, and the
                chart's source. A sheet set up with controls you can't see says so above it, with Show controls and Reset.
              </dd>
            </div>
          </dl>
        </div>

        <div v-if="metronomeOn" class="space-y-3" data-controls-group>
          <UiSubheading :level="3">Practising with a click</UiSubheading>
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
                taps of the beat. <strong class="font-semibold">Swing</strong> or <strong class="font-semibold">Straight</strong>
                sets the feel. Under <strong class="font-semibold">⋯</strong>: a count-in of one or two bars, the skip note
                (swing) or eighths (straight) between the beats, a hat on 2 and 4 in 4/4, and the sound, Wood or Beep. The
                chart remembers its tempo and feel. A chart that changes time signature partway plays the one it starts in.
                On an iPhone or iPad the sound stops when the screen locks.
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
            each scale: the notes they share, and the pentatonic's others added to the staff in a second colour. <strong class="font-semibold">Built on</strong> picks the degree of each chord
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
            chord tones and colour, a pentatonic and one more, or the lowest three and highest three), tinted apart; the
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
          You can change anything in a chart: a reharmonisation, a different scale choice, a bridge you play differently.
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
          <li>If a chord comes up amber, I don't recognise it. Pick a scale for it and it'll draw (<DecisionLink id="scale.unknown">what happens to it until then</DecisionLink>).</li>
          <li>With the editor open, you can also tap a chord on the Changes sheet to change it there. On a phone that's the way to edit: the bars need a bigger screen.</li>
        </ul>

        <UiSubheading :level="3" class="pt-2">The source</UiSubheading>
        <UiText>
          Under the <strong class="font-semibold text-zinc-950 dark:text-white">⋯</strong> menu, <strong class="font-semibold text-zinc-950 dark:text-white">Show source</strong> opens the chart as plain
          text, the same chart as the bars (edit either): a <UiCode>section:</UiCode> line for each section, then one line per
          chord, its bar counted from 1 in the section, always in concert pitch:
        </UiText>
        <pre class="overflow-x-auto rounded-lg bg-zinc-950/2.5 p-4 font-mono text-sm/6 text-zinc-950 ring-1 ring-zinc-950/10 dark:bg-white/5 dark:text-white dark:ring-white/10">{{ EXAMPLE }}</pre>
        <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
          <li>Leave the scale off and you get the chord's default (<UiCode>Cm7</UiCode> gives C Dorian).</li>
          <li>
            Chords can be written the way you'd write them on a napkin: <UiCode>Cm7</UiCode>, <UiCode>C-7</UiCode>,
            <UiCode>Am7b5</UiCode>, <UiCode>G7#9b13</UiCode>, <UiCode>EbMaj7</UiCode>, <UiCode>D7/F#</UiCode>.
          </li>
          <li>
            <UiCode>copy: A1</UiCode> under a <UiCode>section:</UiCode> line repeats section A1 there, which saves typing
            out every AABA tune twice.
          </li>
          <li>
            Under its <UiCode>section:</UiCode> line, a section can have its own <UiCode>key:</UiCode> (and
            <UiCode>@key 5 D</UiCode> changes key from its bar 5), until the section ends. <UiCode>bars: 8</UiCode> says
            how long it is when its last chord is held past its last written bar.
          </li>
          <li>
            Name a section <UiCode>Intro</UiCode>, <UiCode>Coda</UiCode>, <UiCode>Tag</UiCode> or <UiCode>Ending</UiCode>
            and it sits outside the form: it prints where it stands, but the tune's turnaround still goes back to bar 1,
            not to the intro. <UiCode>outside: yes</UiCode> does the same for a section of any name.
          </li>
          <li>
            <UiCode>time: 3/4</UiCode> makes it a waltz (<UiCode>2/4</UiCode>, <UiCode>4/4</UiCode>, <UiCode>5/4</UiCode>
            and <UiCode>6/4</UiCode> work too; 4/4 is what you get without it). With a guide tone line on, the Changes
            sheet writes its guide tones in it. Under a <UiCode>section:</UiCode> line, <UiCode>time:</UiCode> sets that
            section's metre, and <UiCode>@time 11 2/4</UiCode> changes it from bar 11 to the section's end (follow it with
            <UiCode>@time 12 4/4</UiCode> for a single 2/4 bar). The bar menu's Bar in 2/4 … 6/4 does it for you.
          </li>
          <li><UiCode>title:</UiCode> and <UiCode>subtitle:</UiCode> set the heading. <UiCode>composer:</UiCode>, <UiCode>style:</UiCode>, <UiCode>key:</UiCode> and <UiCode>form:</UiCode> fill in the line under it (the subtitle, if there is one, takes the style's place), <UiCode>aka:</UiCode> gives the tune's other titles (a <UiCode>;</UiCode> between them; the library search finds them too), <UiCode>kind:</UiCode> says whether the chart is a <UiCode>tune</UiCode> (without one), a <UiCode>form</UiCode> with no composer (F Blues, Rhythm Changes) or an <UiCode>exercise</UiCode>, <UiCode>context:</UiCode> how the analysis reads it (<UiCode>functional</UiCode>, <UiCode>modal</UiCode> or <UiCode>blues</UiCode>; <strong class="font-semibold">Read as</strong> in the heading sets it, and blues reads it as a blues whatever its form: <DecisionLink id="scale.blues">how</DecisionLink>), and lines starting with <UiCode>#</UiCode> are notes to yourself. A row can end in a note too, after a space and a <UiCode>#</UiCode>: the library's say why each scale was chosen.</li>
          <li>Anything I can't make sense of is listed under the source, with the line number.</li>
        </ul>

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
            music, for practising from a tablet or laptop on the stand. Press <kbd class="font-sans font-semibold">Esc</kbd>
            or <strong class="font-semibold">Exit focus</strong> to come back.
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

const EXAMPLE = `title: Autumn Leaves
subtitle: Full Form

section: A1
# bar | chord | scale
1 | Cm7 | C Dorian
2 | F7  | F Mixolydian
3 | BbMaj7
4 | EbMaj7

section: A2
copy: A1`

const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD.help))
</script>
