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
            please <UiTextLink href="/contact">let me know</UiTextLink> and I'll fix it. There are also some clickable
            links in various places that will show you the reasoning behind the analysis, and you can use those to check
            the logic for yourself or to tell me what to fix.
          </UiText>
        </div>
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
        <UiSubheading id="sheets" class="scroll-mt-6">The two sheets</UiSubheading>
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
          way to learn the changes. <UiTextLink href="#guide-lines">How a line is built</UiTextLink> is below.
        </UiText>
        <UiText>
          <strong class="font-semibold text-zinc-950 dark:text-white">Scales</strong> is one staff per
          chord, with the scale that goes with it, in the order the tune runs. Each staff is labelled with where it is in
          the form, the chord and the scale. Practice works on this sheet.
        </UiText>

        <UiSubheading id="guide-lines" :level="3" class="scroll-mt-6 pt-2">How a guide tone line is built</UiSubheading>
        <UiText>It's the way you'd build one by hand, a chord at a time.</UiText>
        <ul class="list-disc space-y-2 pl-5 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-400">
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">The guide tones.</strong> Each chord's 3rd and 7th.
            Where a chord has no 7th or no 3rd, something else stands in: a 6 chord uses its 6th, a sus chord its 4th, and a
            plain triad its root. (A diminished 7th's 7th is its double-flat 7th.) The label under the note is that degree
            without its flat or sharp: 3, 7, 6, 4 or 1.
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">The start.</strong> From 3rd begins on the first
            chord's 3rd, From 7th on its 7th, in whichever octave keeps the line, up to the next rest, closest on average to
            the middle of your instrument's range. So a line doesn't start in the middle and drift to the bottom.
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">The moves.</strong> At each new chord the line goes
            to whichever of its two guide tones is nearer: a common tone first, then a half step, a whole step, and only then
            a leap. That's why it swaps between 3rd and 7th when the roots move by 4ths and 5ths. When both are equally near,
            it takes the one nearer the middle of the range, then the lower. A chord that repeats the last one's guide tones
            (C7 to C7♭9) ties the note over; a common tone on a different chord is played again.
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">The range.</strong> The line only uses notes your
            instrument can comfortably play, so at the floor or the ceiling it turns back toward the middle. Written ranges:
            {{ GUIDE_RANGES }}.
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">When the two lines meet.</strong> You see one line at
            a time, but the other is worked out alongside it. If both land on the same note, they part at the next new chord.
            If that chord has the note too, the line that was lower keeps it and the other moves to the chord's other guide
            tone, upward if that's no more than a tritone away. Otherwise the one that was higher goes up to the nearest
            guide tone above and the other down to the nearest below. Neither leaps more than a tritone just to get away:
            a line with nothing that close on its side moves as it would on its own, so now and then the two stay together
            for another chord. So From 3rd and From 7th may touch, but they rarely stay together.
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Rests, repeats and spelling.</strong> A chord with no
            guide tones (one I can't read, or a chord quality I don't know) gets a rest, and the line starts again after it, placed the same way as at the
            start. Repeats and endings are played in the order they're written: a second ending carries on from the chord
            before it, and the last bar doesn't lead back to the top. Each note keeps its chord's spelling: the 7th of G♭7 is
            F♭, not E.
          </li>
        </ul>
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
      </section>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="controls">
        <UiSubheading id="controls" class="scroll-mt-6">The preview controls</UiSubheading>
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
            <dt class="font-semibold text-zinc-950 dark:text-white">Analysis and Guide Tones</dt>
            <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
              On the Changes sheet, <strong class="font-semibold">Analysis</strong> holds <strong class="font-semibold">Numerals</strong>
              and <strong class="font-semibold">Scales</strong>, which turn those rows on and off. <strong class="font-semibold">Guide Tones</strong>
              chooses <strong class="font-semibold">Off</strong>, <strong class="font-semibold">From 3rd</strong> or <strong class="font-semibold">From 7th</strong>, the guide tone
              line described above.
              <strong class="font-semibold">Superimpose</strong> puts a row under the chords: <strong class="font-semibold">Off</strong>,
              <strong class="font-semibold">Pentatonic</strong> (each key area's minor pentatonic, or, ranked against
              Chord, each chord's, <strong class="font-semibold">Built on</strong> the degree you choose) or
              <strong class="font-semibold">Hexatonic</strong> (each chord's best triad pair from its scale, such as
              <UiCode>G/Am</UiCode> over Cmaj7: the chord tones it covers first, then two major or minor triads).
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
          <div>
            <dt class="font-semibold text-zinc-950 dark:text-white">Scale level</dt>
            <dd class="mt-1 text-zinc-600 dark:text-zinc-400">
              How fancy the scales get, per chart. <strong class="font-semibold">Basic</strong> leans on pentatonics
              (five notes, hard to land on a wrong one), <strong class="font-semibold">Standard</strong> is the usual
              chord-scale for each chord, and <strong class="font-semibold">Advanced</strong> reaches for bebop,
              Lydian and altered colours. <strong class="font-semibold">Random</strong> deals a different inside scale
              to every chord, so you can't coast; hit <strong class="font-semibold">Shuffle</strong> for a new hand.
              It's in the toolbar above the sheet, and it writes the scales into the chart, so they save, print and share with
              it. Scales you picked yourself stay put, and Standard puts everything else back.
            </dd>
          </div>
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
      </section>

      <section class="scroll-mt-6 space-y-4" aria-labelledby="practice">
        <UiSubheading id="practice" class="scroll-mt-6">Practice: improvise with fewer notes</UiSubheading>
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
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Pentatonic</strong> lights a minor pentatonic over
            each scale: the notes they share, and the pentatonic's others added to the staff in a second colour. <strong class="font-semibold">Built on</strong> picks the degree of each chord
            it starts from: on 2 over Cmaj7 is Dm pentatonic, and over G7 it's Am. <strong class="font-semibold">Auto</strong>
            picks the one that shares the most, nearest the chord's root. The caption under each chord names it and
            counts the notes it shares (<UiCode>Dm pent · 5 shared</UiCode>). {{ PENT_INSIDE_HELP }}
          </li>
          <li>
            <strong class="font-semibold text-zinc-950 dark:text-white">Hexatonic</strong> lights two triads from each
            scale, six notes, after Gary Campbell's <em>Triad Pairs for Jazz</em>. <strong class="font-semibold">Pair</strong>
            <em>n</em> is the triads on degrees <em>n</em> and <em>n</em> + 1 of each staff's scale; on a seven-note scale
            that leaves out degree <em>n</em> − 1 (Pair 1 leaves out the 7th). Pair 5 over C major is G/Am, without the F. <strong class="font-semibold">Auto</strong>
            picks the pair that covers the most chord tones. The grouping splits the six notes in two (the two triads,
            chord tones and colour, a pentatonic and one more, or the lowest three and highest three), tinted apart; the
            caption under each chord names the pair.
          </li>
          <li>
            Click a chord's pentatonic or triad pair (Changes) or a staff's caption (Scales) to pick another for that chord; the list runs from inside to outside. A pick on the Scales sheet sets every bar that staff covers. <strong class="font-semibold text-zinc-950 dark:text-white">Sheet’s choice</strong> undoes it; <strong class="font-semibold text-zinc-950 dark:text-white">⋯ More actions → Reset chord picks</strong> undoes them all.
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
          <li>If a chord comes up amber, I don't recognise it. Pick a scale for it and it'll draw.</li>
          <li>With the editor open, you can also tap a chord on the Changes sheet to change it there. On a phone that's the way to edit: the bars need a bigger screen.</li>
        </ul>

        <UiSubheading :level="3" class="pt-2">The source</UiSubheading>
        <UiText>
          Under the <strong class="font-semibold text-zinc-950 dark:text-white">⋯</strong> menu, <strong class="font-semibold text-zinc-950 dark:text-white">Show source</strong> opens the chart as plain
          text, the same chart as the bars (edit either), one line per chord, always in concert pitch:
        </UiText>
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
            what you get without it). With a guide tone line on, the Changes sheet writes its guide tones in it.
          </li>
          <li><UiCode>title:</UiCode> and <UiCode>subtitle:</UiCode> set the heading. <UiCode>composer:</UiCode>, <UiCode>style:</UiCode>, <UiCode>key:</UiCode> and <UiCode>form:</UiCode> fill in the line under it (the subtitle, if there is one, takes the style's place), <UiCode>aka:</UiCode> gives the tune's other titles (a <UiCode>;</UiCode> between them; the library search finds them too), <UiCode>kind:</UiCode> says whether the chart is a <UiCode>tune</UiCode> (without one), a <UiCode>form</UiCode> with no composer (F Blues, Rhythm Changes) or an <UiCode>exercise</UiCode>, and lines starting with <UiCode>#</UiCode> are notes to yourself. A row can end in a note too, after a space and a <UiCode>#</UiCode>: the library's say why each scale was chosen.</li>
          <li>Anything I can't make sense of is listed under the source, with the line number.</li>
        </ul>

        <UiSubheading :level="3" class="pt-2">Transposing</UiSubheading>
        <UiText>
          <strong class="font-semibold text-zinc-950 dark:text-white">Transpose…</strong> moves the whole chart to another
          key, so you can work on a tune in all twelve. It spells things sensibly for the new key (D♭–7 G♭7 in B♭, not
          C♯–7 F♯7). To undo it, transpose back. That's different from the Instrument setting, which only changes how the
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
            <strong class="font-semibold text-zinc-950 dark:text-white">Download</strong> saves the chart as a plain
            <UiCode>.txt</UiCode> file you can keep anywhere. <strong class="font-semibold">Open chart…</strong> in the
            library (or dropping the file on it) brings it back.
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
            Wondering why a chord got its scale? Click its numeral or scale on the Changes sheet: the note says why and
            names the rule, and <UiTextLink href="/functions#rules">Functions and rules</UiTextLink> lists them all. If
            you'd choose differently, <strong class="font-semibold text-zinc-950 dark:text-white">Report issue</strong>
            in that note collects the details for the contact form.
          </li>
          <li>It works on a phone, but the staves are small. A tablet or a laptop is nicer.</li>
        </ul>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta } from '~/utils/site'
import { guideRanges } from '~/utils/instrumentChoices'
import { PENT_INSIDE_HELP } from '~/utils/pentatonics'

const GUIDE_RANGES = guideRanges()
const SECTIONS = [
  { id: 'quick', title: 'The short version' },
  { id: 'sheets', title: 'The two sheets' },
  { id: 'controls', title: 'Preview controls' },
  { id: 'practice', title: 'Practice' },
  { id: 'editing', title: 'Editing a chart' },
  { id: 'saving', title: 'Saving your work' },
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

const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD.help))
</script>
