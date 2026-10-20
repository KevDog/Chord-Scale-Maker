import type { ScaleKey } from '@chord-scale-maker/engine'

/** the /scales index's sections, each scale in one, in the order a player learns them */
export type ScaleGroup = Readonly<{ title: string; scales: readonly ScaleKey[] }>

export const SCALE_GROUPS: readonly ScaleGroup[] = [
  { title: 'Major modes', scales: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'] },
  { title: 'Melodic minor modes', scales: ['melodic minor', 'dorian b2', 'lydian augmented', 'lydian dominant', 'mixolydian b6', 'locrian natural 2', 'altered'] },
  { title: 'Harmonic minor and its modes', scales: ['harmonic minor', 'phrygian dominant', 'spanish phrygian'] },
  { title: 'Symmetric', scales: ['half whole diminished', 'whole half diminished', 'whole tone', 'augmented'] },
  { title: 'Pentatonic and blues', scales: ['major pentatonic', 'minor pentatonic', 'blues'] },
  { title: 'Bebop', scales: ['bebop dominant', 'bebop major', 'bebop dorian'] },
  {
    title: 'Diminished, by function',
    scales: [
      'diatonic diminished',
      'diatonic diminished #iv',
      'diatonic diminished #iv optional',
      'diatonic diminished biii',
      'diatonic diminished biii optional',
      'diatonic diminished bvi',
      'diatonic diminished i',
      'diatonic diminished i optional',
      'diatonic diminished v',
    ],
  },
]

export const scaleGroupOf = (key: ScaleKey): string | undefined => SCALE_GROUPS.find((g) => g.scales.includes(key))?.title
