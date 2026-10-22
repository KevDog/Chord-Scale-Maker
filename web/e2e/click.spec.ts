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

test('the docked bar’s room at the page’s foot doesn’t print', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await clickUntil(page, page.getByRole('button', { name: 'Click', exact: true }), clickBar(page))
  const padding = () => page.evaluate(() => getComputedStyle(document.body).paddingBottom)
  await expect.poll(padding).not.toBe('0px')
  await page.emulateMedia({ media: 'print' })
  // a real print may lay out before the bar's height is measured again: the CSS alone must drop the room
  await page.evaluate(() => document.documentElement.style.setProperty('--click-h', '60px'))
  expect(await padding()).toBe('0px')
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

for (const [phone, viewport] of [['iPhone 14', { width: 390, height: 844 }], ['Pixel 7', { width: 412, height: 915 }]] as const) {
  test.describe(`on a phone (${phone})`, () => {
    test.use({ viewport, hasTouch: true })

    test('the docked click fits the screen, its settings too, and the page’s foot clears it', async ({ page }) => {
      await page.goto('/song/autumn-leaves')
      await clickUntil(page, page.getByRole('button', { name: 'Click', exact: true }), clickBar(page))
      const bar = clickBar(page)
      const box = (await bar.boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
      for (const name of ['Start', 'Slower', 'Faster', 'Tap the tempo', 'Click settings', 'Hide the click']) {
        const b = (await bar.getByRole('button', { name, exact: true }).boundingBox())!
        expect(b.x, name).toBeGreaterThanOrEqual(0)
        expect(b.x + b.width, name).toBeLessThanOrEqual(viewport.width)
        expect(b.y, name).toBeGreaterThanOrEqual(box.y)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      await bar.getByRole('button', { name: 'Click settings' }).click()
      const settings = page.getByRole('dialog', { name: 'Click settings' })
      await expect(settings).toBeVisible()
      const s = (await settings.boundingBox())!
      expect(s.x).toBeGreaterThanOrEqual(0)
      expect(s.x + s.width).toBeLessThanOrEqual(viewport.width)
      expect(s.y).toBeGreaterThanOrEqual(0)
      await page.keyboard.press('Escape')
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const foot = (await page.locator('footer').last().boundingBox())!
      expect(foot.y + foot.height).toBeLessThanOrEqual((await bar.boundingBox())!.y + 1)
    })

    test('in focus mode the click fits above the pages', async ({ page }) => {
      await page.goto('/song/autumn-leaves')
      await clickUntil(page, page.getByRole('button', { name: 'Click', exact: true }), clickBar(page))
      await page.getByRole('button', { name: 'Controls' }).click()
      await page.getByRole('dialog', { name: 'Controls' }).getByRole('button', { name: 'Focus', exact: true }).click()
      const focus = page.getByRole('dialog', { name: 'Focus mode' })
      const bar = (await focus.getByRole('toolbar', { name: 'Click' }).boundingBox())!
      expect(bar.x + bar.width).toBeLessThanOrEqual(viewport.width)
      const paper = (await focus.locator('svg[role=img]').first().locator('xpath=ancestor::section[1]').boundingBox())!
      expect(paper.y).toBeGreaterThanOrEqual(bar.y + bar.height)
    })
  })
}
