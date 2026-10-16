import { arpeggiosDrawn, chooseSuperimpose, expect, hexatonicPreset, pickOption, showArpeggios, staves, test, writeChart } from './fixtures'
import type { Page } from '@playwright/test'

// one staff per chord: C Ionian, D Dorian, G Mixolydian, B Locrian (the chords' own scales in C), and two written
// scales: whole tone (no triad pair) and half-whole (eight notes, Campbell's chain)
const CHART = 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | Dm7\nA | 3 | G7\nA | 4 | Bm7b5\nA | 5 | C7 | C Whole Tone\nA | 6 | C7 | C Half-Whole'

type Row = Readonly<{ caption: string; notes: number; a: number; b: number }>

/** each staff's caption, and how many of its notes are drawn, lit as group A, lit as group B */
const rows = (page: Page): Promise<Row[]> =>
  staves(page).evaluateAll((svgs) =>
    svgs.map((s) => ({
      caption: s.closest('.grid')?.querySelector('[data-slot="hexatonic"]')?.textContent ?? '',
      notes: s.querySelectorAll('.vf-selected, .vf-dimmed').length,
      a: s.querySelectorAll('.vf-selected:not(.vf-second)').length,
      b: s.querySelectorAll('.vf-selected.vf-second').length,
    })),
  )

// Auto's pair on each staff, and its groups' sizes, hand-derived from each pair (the engine tests check the notes):
// Chord tones + color: the chord's four tones are all in each Auto pair; Pentatonic + 1: a minor pentatonic wholly
// inside the seven-note pairs (B the one note left), but on half-whole the best (Am or Cm) shares 4, so B is two
const CAPTIONS = ['G/Am hex', 'C/Dm hex', 'Dm/Em hex', 'Dm/Em hex', 'no triad pair', 'E♭/Am hex']
const NOTES = [7, 7, 7, 7, 6, 8]
const GROUPS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  'Triad pair': [[3, 3], [3, 3], [3, 3], [3, 3], [0, 0], [3, 3]],
  'Chord tones + color': [[4, 2], [4, 2], [4, 2], [4, 2], [0, 0], [4, 2]],
  'Pentatonic + 1': [[5, 1], [5, 1], [5, 1], [5, 1], [0, 0], [4, 2]],
  'Trichords 3+3': [[3, 3], [3, 3], [3, 3], [3, 3], [0, 0], [3, 3]],
}

test('the Hexatonic preset captions each staff and lights its pair in two groups, in every grouping', async ({ page }) => {
  await writeChart(page, CHART)
  await hexatonicPreset(page)
  await expect(page.getByRole('button', { name: 'Hexatonic pair' })).toContainText('Auto')
  await expect(page.getByRole('button', { name: 'Hexatonic grouping' })).toContainText('Triad pair')
  for (const [grouping, groups] of Object.entries(GROUPS)) {
    await pickOption(page, 'Hexatonic grouping', grouping)
    await expect(page.locator('[data-slot="hex-legend"]')).toBeVisible()
    await expect.poll(() => rows(page)).toEqual(CAPTIONS.map((caption, i) => ({ caption, notes: NOTES[i], a: groups[i]![0], b: groups[i]![1] })))
  }
})

test('Pair 5 on a C major staff is G/Am, leaving out F; Pair 1 is C/Dm, leaving out B', async ({ page }) => {
  await writeChart(page, CHART)
  await hexatonicPreset(page)
  const caption = (i: number) => page.locator('[data-slot="hexatonic"]').nth(i)
  await pickOption(page, 'Hexatonic pair', '5')
  await expect(caption(0)).toHaveText('G/Am hex')
  await expect(caption(1)).toHaveText('Am/B° hex') // D Dorian's degrees 5 and 6
  const dimmed = () => staves(page).first().evaluate((s) => Array.from(s.querySelectorAll('.vf-selected, .vf-dimmed')).findIndex((n) => n.classList.contains('vf-dimmed')))
  expect(await dimmed()).toBe(3) // C D E [F] G A B: degree 4
  await pickOption(page, 'Hexatonic pair', '1')
  await expect(caption(0)).toHaveText('C/Dm hex')
  await expect.poll(dimmed).toBe(6) // pair 1 leaves out degree 7, B
  await expect(caption(5)).toHaveText('C/F♯m hex') // half-whole: Campbell's first link
})

test('the Changes sheet’s Superimpose: Hexatonic shows each chord’s pair and no pentatonic controls; Pentatonic restores them', async ({ page }) => {
  await writeChart(page, CHART)
  await chooseSuperimpose(page, 'Hexatonic')
  const labels = page.locator('[data-slot="hexatonic"] > span') // each label's inner text: on screen its trigger, in print plain text (#303)
  await expect(labels.first()).toHaveText('G/Am', { useInnerText: true })
  await expect.poll(() => labels.allInnerTexts()).toEqual(['G/Am', 'C/Dm', 'Dm/Em', 'E♭/Am']) // Bm7♭5 repeats Dm/Em; whole tone has none
  await expect(page.locator('[data-slot="pentatonic"]')).toHaveCount(0)
  await expect(page.locator('[data-slot="contour"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pentatonic rung' })).toHaveCount(0)
  await chooseSuperimpose(page, 'Pentatonic')
  await expect(page.locator('[data-slot="hexatonic"]')).toHaveCount(0)
  await expect(page.locator('[data-slot="pentatonic"] button').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pentatonic rung' })).toBeVisible()
  await chooseSuperimpose(page, 'Off')
  await expect(page.locator('[data-slot="pentatonic"], [data-slot="hexatonic"]')).toHaveCount(0)
})

test('the Line plays each chord’s labelled triad pair under the Hexatonic overlay, and 7th Chords again without it (#325)', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | Cmaj7\nA | 2 | Dm7\n')
  const line = page.locator('svg[aria-label^="Bars:"]').first()
  await showArpeggios(page, 'Up · root')
  await arpeggiosDrawn(page)
  await chooseSuperimpose(page, 'Hexatonic')
  await expect(page.getByRole('radio', { name: 'Triad pair', exact: true })).toBeChecked() // the stored arpeggio line, read as Triad pair
  await expect(page.getByLabel('Leave out')).toHaveCount(0)
  await expect(line).toHaveAttribute('aria-label', /; triad pair: G4 B4 D5 C5 \| E5 C5 G4 F4/) // G/Am, then C/Dm from the note nearest C5, turned at the top
  await pickOption(page, 'Triad pair direction', 'Down')
  await expect(line).toHaveAttribute('aria-label', /; triad pair: D5 B4 G4 /)
  await chooseSuperimpose(page, 'Off')
  await expect(page.getByRole('radio', { name: '7th Chords', exact: true })).toBeChecked()
  await arpeggiosDrawn(page)
  await expect(line).toHaveAttribute('aria-label', /; 7th chords: C4 E4 G4 B4/)
})
