import { chooseSuperimpose, expect, pickOption, quartalPreset, staves, test, writeChart } from './fixtures'

// the ii–V–I in C, and a half-whole staff, which has no stack (#432)
const CHART = 'title: T\nkey: C\n\nsection: A\nbars: 4\n1 | Dm7\n2 | G7\n3 | CMaj7\n4 | C7 | C Half-Whole'

/** each staff's lit notes */
const lit = (page: Parameters<typeof staves>[0]) => staves(page).evaluateAll((svgs) => svgs.map((s) => s.querySelectorAll('.vf-selected').length))

test('the Quartal preset captions each staff with its stack of fourths and lights its notes', async ({ page }) => {
  await writeChart(page, CHART)
  await quartalPreset(page)
  const captions = page.locator('[data-slot="quartal"]')
  await expect.poll(() => captions.allInnerTexts()).toEqual(['D G C F · 4ths', 'F B E A · 4ths', 'B E A D · 4ths', 'no 4ths stack'])
  await expect.poll(() => lit(page)).toEqual([4, 4, 4, 0])
  await page.getByRole('group', { name: 'Quartal notes' }).getByText('3', { exact: true }).click()
  await expect.poll(() => lit(page)).toEqual([3, 3, 3, 0])
  await pickOption(page, 'Quartal built on', '5')
  await expect(captions.first()).toHaveText('A D G · 4ths')
})

test('the Changes sheet’s Superimpose: Quartal names each chord’s stack; its options and a pick change it', async ({ page }) => {
  await writeChart(page, CHART)
  await chooseSuperimpose(page, 'Quartal')
  const labels = page.locator('[data-slot="quartal"] > span')
  await expect.poll(() => labels.allInnerTexts()).toEqual(['D G C F', 'F B E A', 'B E A D']) // half-whole has none
  await page.getByRole('button', { name: 'Quartal options' }).click()
  await page.getByRole('group', { name: 'Quartal notes' }).getByText('3', { exact: true }).click()
  await expect.poll(() => labels.allInnerTexts()).toEqual(['G C F', 'F B E', 'B E A'])
  await page.keyboard.press('Escape')
  await labels.first().getByRole('button').click()
  await page.locator('[data-choice]').filter({ hasText: /^D G C · / }).click()
  await expect(labels.first()).toHaveText('D G C', { useInnerText: true })
  await chooseSuperimpose(page, 'Off')
  await expect(page.locator('[data-slot="quartal"]')).toHaveCount(0)
})
