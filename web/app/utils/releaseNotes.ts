/**
 * What changed for a player, newest first (docs/superpowers/specs/2026-10-17-user-docs-restructure-design.md §12): the
 * /release-notes page. A PR that changes what a user sees adds a line here (the docs gate checks), under today's date,
 * in plain words and with its PR number; internal work isn't listed.
 */
export type ReleaseItem = Readonly<{ text: string; pr?: number }>
export type ReleaseNote = Readonly<{ date: string; items: readonly ReleaseItem[] }>

export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    date: '2026-10-22',
    items: [
      { text: 'A rhythm for the Changes sheet: in the Line’s options (Intermediate interface), Rhythm draws slashes with stems, beams, rests, ties and accents in place of the beat slashes, while Line is Off. Choose a unit (8ths in 5, after Saindon), a run of 8ths from a beat (after Bergonzi), a card, or type your own; the caption says when it is back on one. Target beats puts a dot over each strong beat, after Galper.' },
      { text: 'Charts can now be in 7/4: write time: 7/4 in the heading, or choose Bar in 7/4 from the bar menu for a single bar.', pr: 487 },
      { text: 'A click to practise with: Click (the note icon, beside Print) puts a metronome at the foot of a song’s page, at a tempo and feel from the chart’s style. Feel plays Swing (the skip note), Straight (even eighths) or Quarters. Tap sets the tempo, Space starts and stops it, and its settings add a count-in, a hat on 2 and 4, and a wood or beep sound. Its chevron folds it to one row while it plays, and it comes into focus mode, still playing.', pr: 497 },
      { text: 'Edit alternate changes on the sheet: while editing, a small line above the bars takes each bar’s alternate (+ alt, then type; Tab for the next bar), and with Changes set to Alternate the big chords are the alternate set. A chart with alternates no longer forces its Source open.', pr: 490 },
      { text: 'The small line of other changes shows a chord held from an earlier bar (in italics), and an alternate typed the same as the chord already held there isn’t kept.', pr: 495 },
      { text: 'A simpler menu bar: Library, Scales, and a Help menu with How it works, How it decides, Functions, About and Contact.' },
      { text: 'On a phone, the home page’s instrument picker sits under the search box instead of squeezing it.' },
    ],
  },
  {
    date: '2026-10-21',
    items: [
      { text: 'Rhythm Changes now carries alternate changes: Changes → Alternate, in the toolbar above the sheet, plays them on every sheet, and Other changes prints the other set small above the bars.', pr: 476 },
      { text: 'Back up your charts: the library’s Backup menu saves My charts, their settings and your preferences to one file (Back up…), and Restore from backup… brings them into this or another browser; where a chart is in both, you choose Keep both or Keep mine.', pr: 473 },
      { text: 'The Scales sheet’s Practice panel folds its explanation under How it works, so the music starts higher on the page.', pr: 464 },
      { text: 'The Cells line now plays phrases. Phrase (on by default) picks each cell to lead into the next chord, and over a long dominant it borrows the tritone sub and the minor-3rd dominant (D♭7 and B♭7 over G7). Order plays the cells As written, Reversed, Rotated or Pairs swapped, and a new Chromatic group adds 1 ♮7 7 6, ♭9 1 3 5, II–V chromatic and more.', pr: 461 },
      { text: 'iReal Pro import plays out a repeat over several sections: A Foggy Day comes in as A B A C, its second A a copy of the first, where it used to be written out once with a report.', pr: 456 },
    ],
  },
  {
    date: '2026-10-20',
    items: [
      { text: 'The Version menu moves onto the row of sheet controls, so on a phone the music starts higher (Controls is its icon there). It also lists your saved charts titled by a tune’s other name, Les Feuilles mortes, or as a copy, “Autumn Leaves (copy)”.', pr: 453 },
      { text: 'A shared link to a tune’s other version, Summertime (Jazz Mind Accelerator), now opens that version, matching its preview card’s title and image.', pr: 452 },
      { text: 'The Version menu reads its version aloud with its name, “Version, Ballad”, to a screen reader, and once you have a chart of the tune its library versions sit under Library, beside Mine.', pr: 451 },
      { text: 'Recently opened names a tune’s other versions by their label, “Summertime (Jazz Mind Accelerator)”, so two versions no longer read alike.', pr: 450 },
    ],
  },
  {
    date: '2026-10-19',
    items: [
      { text: 'Triad pairs from the tritone sub: a dominant chord’s pick list ends with pairs from its tritone substitute’s scale, B/D♭ over G7 (from D♭7), after Walt Weiskopf. On the Changes, Scales and Arpeggios sheets.', pr: 449 },
      { text: 'The Scales, Arpeggios and Patterns sheets start every line with the clef and key signature, so a line read on its own is in its key. A Patterns run that continues onto a second staff starts that staff bare.', pr: 448 },
      { text: 'A new scale, Augmented (1 ♯2 3 5 ♯5 7: two augmented triads a minor third apart): the Advanced level’s scale over maj7♯5 and augmented chords, and an option over maj7. Its triad pair is those two triads (C+/D♯+), after Walt Weiskopf.', pr: 447 },
      { text: '54 blues from iReal Pro’s Blues 50: Muddy Waters, Howlin’ Wolf, Robert Johnson, B.B. King, Willie Dixon and more, each read as a blues (the key’s Blues scale at Basic).', pr: 445 },
      { text: 'Triad pair line: a Shape in Line options, after Walt Weiskopf: Climb (both triads in root position, then 1st and 2nd inversion, rising: F A C, G B D, A C F, …) and Arpeggios 1 3 5 8. Nearest is the line as it was.', pr: 444 },
      { text: 'Line: under Superimpose: Quartal the 7th Chords slot plays Quartal, each chord’s stack of fourths whole, then its next stacks, up, down or both. Quartal options’ Notes gains Auto: four notes a stack where your range has room, else three.', pr: 443 },
    ],
  },
  {
    date: '2026-10-18',
    items: [
      { text: 'Superimpose: Quartal names each chord’s stack of fourths under it on the Changes sheet (D G C F over Dm7); click one to pick another. Quartal options set three or four notes and perfect fourths only.', pr: 442 },
      { text: 'Practice: a Quartal preset lights a stack of fourths from each scale (D G C F over Dm7, F B E A over G7), Built on a degree you choose, of three or four notes, perfect fourths only if you like.', pr: 441 },
      { text: 'Hexatonic: the diminished scales gain the pairs a tritone apart (C/F♯ over C7♭9, now its Auto pair), and the whole-tone scale its two augmented triads (C+/D+), after Walt Weiskopf.', pr: 440 },
      { text: 'Hexatonic: Ranked against Key gives every chord in a key area the same triad pair, its IV and V triads (F/G across Dm7 G7 Cmaj7 in C), after Walt Weiskopf. On the Changes under Hexatonic options, and in the Scales sheet’s Hexatonic preset.', pr: 439 },
      { text: 'Triad pairs on the Arpeggios sheet: each chord’s triad pair as six triads through their inversions, arpeggiated or as block chords. Click the pair under the chord to pick another.', pr: 438 },
      { text: 'The Triad pair line’s Up & down now alternates chord by chord; with four notes a chord it only went up.', pr: 434 },
      { text: 'Blues read as blues: Mixolydian on the I, IV and V (Dorian on a minor blues’ i and iv), the key’s Blues scale at Basic, and Read as in the heading to say a chart is a blues whatever its form.', pr: 437 },
      { text: 'Transpose… moves beside Edit: both rewrite the chart. Print is lighter, its label in the accent colour.', pr: 431 },
      { text: 'The controls above the sheet take two rows instead of four: the Instrument button shows your instrument and range and opens them in a panel, and a line’s details open from Line options beside it.', pr: 429 },
      { text: 'Patterns: Stacked fourths, two fourths stacked from each scale note.', pr: 435 },
      { text: '18 charts from the Jazz Mind Accelerator backing tracks: versions of 15 library tunes, and Fly Me to the Moon, Mack the Knife and A Child Is Born.', pr: 421 },
      { text: 'Versions: a tune with more than one chart has a Version menu above its sheet, your own charts of it included.', pr: 419 },
      { text: 'The Instrument picker in two steps: the pitch (Concert, B♭, E♭, F, Bass), then your instrument.', pr: 420 },
      { text: 'Links from where a choice shows (a chord’s why note, Practice, chord picks, Transpose) to How it decides.', pr: 412 },
      { text: 'Release notes: this page.' },
      { text: 'How it decides: every choice the app makes for you, the rule behind it, and an example.', pr: 408 },
      { text: 'Approaches now lead the 7th Chords and Cells lines into each chord, not only the guide tones.', pr: 393 },
      { text: 'A song’s description names its notable recording.', pr: 392 },
      { text: 'A video that won’t play embedded shows a Listen on YouTube link instead.', pr: 391 },
      { text: 'The Superimpose control keeps its place when you change its options.', pr: 388 },
    ],
  },
  {
    date: '2026-10-17',
    items: [
      { text: 'The Patterns sheet: a scale sequence run over each scale line, from a library of patterns or your own.', pr: 371 },
      { text: 'Melodic cells on the Changes sheet, after Randy Vincent’s Building Solo Lines From Cells.', pr: 374 },
      { text: 'Approach notes and enclosures leading into each guide tone.', pr: 382 },
      { text: 'Set your own range for each instrument; every line keeps to it.', pr: 362 },
      { text: 'Lines turn back before the edge of your range instead of drifting to it.', pr: 386 },
      { text: 'Notable recordings on song pages, for the first 23 tunes.', pr: 361 },
      { text: 'Scale pages and composer pages.', pr: 346 },
      { text: 'More chord symbols read: 13sus, m13, add9, m7add11, aug, (#11), and tensions in any order.', pr: 345 },
      { text: 'Metre changes partway through a chart, and 5/4 and 6/4.', pr: 342 },
      { text: 'The Arpeggios sheet’s 7th Chord runs span two octaves.', pr: 343 },
      { text: 'Piano is the default instrument.', pr: 338 },
      { text: 'Piano’s lines use F3–E6.', pr: 339 },
      { text: 'N.C. is a rest.', pr: 337 },
      { text: 'Works offline once you’ve opened it.', pr: 341 },
    ],
  },
  {
    date: '2026-10-16',
    items: [
      { text: 'A Pentatonic line under the Pentatonic superimpose, and a Triad pair line under the Hexatonic.', pr: 326 },
      { text: 'Controls ease in and out as you change the Interface level.', pr: 330 },
      { text: 'Better contrast in dark mode, and larger targets for small labels.', pr: 327 },
    ],
  },
  {
    date: '2026-10-15',
    items: [
      { text: 'Chord picks: choose one chord’s pentatonic or triad pair, on either sheet.', pr: 309 },
      { text: 'Interface levels: Essentials, Intermediate and Everything.', pr: 290 },
      { text: 'Hexatonic triad pairs: a Practice preset on the Scales sheet, and a Superimpose on the Changes.', pr: 295 },
      { text: 'Pentatonics are built on a degree of each chord.', pr: 304 },
      { text: 'Undo and redo cover your note choices too.', pr: 316 },
      { text: 'The home page: Tune of the day, and what the site does.', pr: 250 },
      { text: 'Bebop and Spanish Phrygian scales spelled without C♭, F♭, E♯ or double accidentals.', pr: 288 },
    ],
  },
  {
    date: '2026-10-14',
    items: [
      { text: 'Pentatonics on the Changes sheet: each key area’s ladder from inside to outside, paths that step by section, key area or bars, and a pentatonic per chord.', pr: 263 },
      { text: 'A Pentatonic practice preset on the Scales sheet.', pr: 271 },
      { text: 'Pentatonic picks follow their chords when you add or remove bars.', pr: 283 },
      { text: 'Diminished scales spelled without double accidentals.', pr: 280 },
    ],
  },
  {
    date: '2026-10-13',
    items: [
      { text: 'The home page has a large tune search; the library moves to its own page.', pr: 247 },
    ],
  },
  {
    date: '2026-10-12',
    items: [
      { text: 'Edit a chart on the sheet itself: chords, numerals, scales, bars and sections, where they print.', pr: 137 },
      { text: 'The Arpeggios sheet.', pr: 204 },
      { text: 'A 7th Chords arpeggio line on the Changes sheet.', pr: 186 },
      { text: 'The Scales sheet has one line per scale.', pr: 197 },
      { text: 'Each tune has its own address, /song/<name>, and its own page in search results.', pr: 175 },
      { text: 'A new look: a control rail above the sheet, the sheet as pages in Focus, and the music first on phones.', pr: 213 },
      { text: 'Spell Scale starts from the chart’s key by default.', pr: 172 },
      { text: 'A written function that doesn’t fit its chord is marked.', pr: 190 },
      { text: 'Chord names on neighbouring beats no longer overlap.', pr: 150 },
    ],
  },
  {
    date: '2026-10-11',
    items: [
      { text: 'Guide tone lines built one at a time: lines that meet move apart, and each starts in the middle of your range.', pr: 102 },
      { text: 'A blank scale plays the analysis, at the sheet’s level.', pr: 125 },
      { text: 'Tap a chord on the Changes sheet to edit it.', pr: 118 },
      { text: 'Transposing a minor chart keeps it minor, spelled on the new key’s side.', pr: 127 },
    ],
  },
  {
    date: '2026-10-10',
    items: [
      { text: 'Guide tone lines from the 3rd and the 7th on the Changes sheet.', pr: 87 },
      { text: 'Functions and rules: the rule behind each chord’s scale, and Report issue.', pr: 89 },
      { text: 'Write a chord’s function or a key change into the chart, and see the analysis live.', pr: 83 },
      { text: 'The clef and key signature once, at the start of each sheet.', pr: 85 },
    ],
  },
  {
    date: '2026-10-09',
    items: [
      { text: 'The Changes sheet: the tune as a lead sheet, with each chord’s numeral and scale.', pr: 64 },
      { text: 'First and second endings, D.C., segno and coda.', pr: 68 },
    ],
  },
  {
    date: '2026-10-08',
    items: [
      { text: 'Scale levels: Basic, Standard, Advanced and Random.', pr: 51 },
      { text: 'Save without an account: My charts, Download and Open, and share links.', pr: 49 },
      { text: 'Waltzes and 2/4, with guide tones in time.', pr: 63 },
      { text: 'Intros, codas, tags and endings sit outside the form.', pr: 62 },
      { text: 'Spanish Phrygian, sus♭9 chords, and D♭maj7/C.', pr: 45 },
    ],
  },
  {
    date: '2026-10-06',
    items: [
      { text: 'Practice: pick a handful of notes from each scale to improvise with.', pr: 29 },
      { text: 'Focus mode: the sheet music alone.', pr: 32 },
      { text: 'The Help, About, Contact and Privacy pages; attach a chart photo or PDF to a request.', pr: 36 },
      { text: 'Interval labels under the notes, on by default.', pr: 42 },
    ],
  },
  {
    date: '2026-10-05',
    items: [
      { text: 'Scales spelled one way at a time.', pr: 20 },
      { text: 'Pentatonics inside and outside, and interval labels.', pr: 14 },
      { text: 'Guide tone lines in print.', pr: 18 },
    ],
  },
  {
    date: '2026-10-04',
    items: [
      { text: 'Chord Scale Maker on the web: the library, a chart editor, the sheet for your instrument, and printing.', pr: 2 },
      { text: 'Transposing instruments, and where each scale starts.', pr: 3 },
      { text: 'Transpose a chart to another key.', pr: 8 },
    ],
  },
]
