import { chooseInterface, chooseSheet, drawn, expect, pickOption, staves, test } from './fixtures'

const heads = (page: import('@playwright/test').Page) => page.locator('svg[role=img]').first().locator('.vf-stavenote')

test('the Patterns sheet draws a pattern over each scale line, and keeps its choices', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Patterns')
  await expect(staves(page)).toHaveCount(28) // the default 29-note run continues onto a second stave
  await expect(page.getByText('(Patterns)').first()).toBeVisible()
  const before = await heads(page).count()
  await pickOption(page, /^Pattern$/, 'Thirds')
  await expect(page.getByRole('button', { name: 'Pattern', exact: true })).toContainText('Thirds')
  await page.locator('label', { hasText: 'Chord tones' }).click()
  await expect(heads(page)).not.toHaveCount(before)
  await page.reload() // the sheet opens on the Changes again; the pattern, notes and direction are kept
  await chooseSheet(page, 'Patterns')
  await expect(page.getByRole('button', { name: 'Pattern', exact: true })).toContainText('Thirds')
  await expect(page.getByRole('radio', { name: 'Chord tones' })).toBeChecked()
  await expect(staves(page)).toHaveCount(14)
})

test('a bad custom pattern shows its error and keeps the sheet', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Patterns')
  await pickOption(page, /^Pattern$/, 'Custom…')
  const box = page.getByLabel('Custom pattern')
  await box.fill('+0')
  await expect(page.locator('#pattern-error')).toBeVisible()
  await expect(box).toHaveAttribute('aria-describedby', 'pattern-error')
  await expect(staves(page)).toHaveCount(28) // the default 29-note run continues onto a second stave
  await box.fill('+1 +2 -2')
  await expect(page.locator('#pattern-error')).toHaveCount(0)
})

test('a share link reopens the Patterns sheet with its choices', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Patterns')
  await pickOption(page, /^Pattern$/, 'Thirds')
  await page.locator('label', { hasText: 'Chord tones' }).click()
  await pickOption(page, 'Pattern direction', 'Down')
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=/)
  const link = await box.inputValue()
  const fresh = await browser.newContext()
  await chooseInterface(fresh, 'everything')
  const visitor = await fresh.newPage()
  await visitor.goto(link)
  await expect(staves(visitor)).toHaveCount(14)
  await expect(visitor.getByRole('button', { name: 'Pattern', exact: true })).toContainText('Thirds')
  await expect(visitor.getByRole('radio', { name: 'Chord tones' })).toBeChecked()
  await expect(visitor.getByRole('button', { name: 'Pattern direction' })).toContainText('Down')
})

test('a long run continues onto further staves: no overlapping heads or labels, the chord labeled once', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Patterns')
  await pickOption(page, /^Pattern$/, 'Custom…')
  await page.getByLabel('Custom pattern').fill('+1 +1 +1 +1 -3')
  await pickOption(page, 'Pattern direction', 'Up & down')
  await expect(page.getByText('Intervals from the chord root:').first()).toBeAttached()
  const all = staves(page)
  await expect.poll(() => all.count()).toBeGreaterThan(14)
  for (let i = 0; i < (await all.count()); i++) {
    const heads = [...(await drawn(all.nth(i))).heads].sort((a, b) => a.x - b.x)
    heads.slice(1).forEach((h, j) => expect(h.x, `staff ${i} head ${j + 1}`).toBeGreaterThanOrEqual((heads[j]?.x ?? 0) + (heads[j]?.w ?? 0) * 0.5))
  }
  const rows = page.locator('p.relative:has(span.sr-only)')
  for (let i = 0; i < (await rows.count()); i++) {
    const boxes = (await rows.nth(i).locator('span.absolute').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))).sort((a, b) => a.left - b.left)
    boxes.slice(1).forEach((b, j) => expect(b.left, `labels ${i} ${j + 1}`).toBeGreaterThanOrEqual((boxes[j]?.right ?? 0) - 0.5))
  }
  // a line's chord is labeled on its first stave only
  const labeled = await page.locator('.grid-cols-\\[8rem_1fr\\]').evaluateAll((els) => els.filter((e) => (e.firstElementChild?.textContent ?? '').trim() !== '').length)
  expect(labeled).toBe(14)
})
