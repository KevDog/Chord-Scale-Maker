import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** click until it takes: a click before hydration is lost */
async function clickUntil(page: Page, button: Locator, shown: Locator): Promise<void> {
  await expect(async () => {
    if (!(await shown.isVisible())) await button.click({ timeout: 1000 })
    await expect(shown).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

const clickBar = (page: Page) => page.getByRole('toolbar', { name: 'Click' })

test('the click opens from the rail, runs, and follows into focus mode (#254)', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await clickUntil(page, page.getByRole('button', { name: 'Click', exact: true }), clickBar(page))
  const bar = clickBar(page)
  await expect(bar.getByRole('spinbutton', { name: 'Tempo' })).toHaveValue('132') // style: Medium
  await bar.getByRole('button', { name: 'Start' }).click()
  await expect(bar.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-pressed', 'true')
  await expect(bar.locator('[data-testid=click-lights] i[data-on]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  const focus = page.getByRole('dialog', { name: 'Focus mode' })
  await expect(focus.getByRole('toolbar', { name: 'Click' })).toBeVisible()
  await expect(focus.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-pressed', 'true') // still running
  await page.keyboard.press('Escape')
  await expect(focus).toBeHidden()
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()) // Escape gave Focus back its focus: Space there is Focus's own
  await page.keyboard.press(' ')
  await expect(bar.getByRole('button', { name: 'Start' })).toBeVisible() // Space stopped it
  await bar.getByRole('button', { name: 'Start' }).click()
  await page.goto('/library') // leaving stops it, with no error (the fixture fails on one)
  await expect(page.getByRole('toolbar', { name: 'Click' })).toHaveCount(0)
})

test('a tempo typed out of range is clamped, and the chart remembers it', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await clickUntil(page, page.getByRole('button', { name: 'Click', exact: true }), clickBar(page))
  const tempo = clickBar(page).getByRole('spinbutton', { name: 'Tempo' })
  await tempo.fill('999')
  await tempo.press('Enter')
  await expect(tempo).toHaveValue('300')
  await tempo.fill('')
  await tempo.blur()
  await expect(tempo).toHaveValue('300')
  await page.reload()
  await clickUntil(page, page.getByRole('button', { name: 'Click', exact: true }), clickBar(page))
  await expect(clickBar(page).getByRole('spinbutton', { name: 'Tempo' })).toHaveValue('300')
})

test('focus mode’s pages fit under its bar with the click in it', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await clickUntil(page, page.getByRole('button', { name: 'Click', exact: true }), clickBar(page))
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  const focus = page.getByRole('dialog', { name: 'Focus mode' })
  const bar = await focus.getByRole('toolbar', { name: 'Click' }).boundingBox()
  const paper = await focus.locator('svg[role=img]').first().locator('xpath=ancestor::section[1]').boundingBox()
  const height = page.viewportSize()!.height
  expect(bar && paper).toBeTruthy()
  expect(paper!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height)
  expect(paper!.y + paper!.height).toBeLessThanOrEqual(height)
})
