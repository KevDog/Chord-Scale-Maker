import { chooseSheet, expect, pickOption, showLine, test } from './fixtures'
import type { Page } from '@playwright/test'

// controls that come and go with an option ease in and out (#297): a collapsing row with a fade, or with reduced
// motion (the other specs' default, playwright.config.ts) a fade only

/** from now on, each transition that starts on an eased row: its property, and whether it was entering or leaving */
const recordEasing = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as unknown as { eased: string[] }
    w.eased = []
    document.addEventListener('transitionrun', (e) => {
      const el = e.target as HTMLElement
      if (el.classList.contains('ease-grid')) w.eased.push(`${el.classList.contains('ease-leave-active') ? 'leave' : 'enter'} ${e.propertyName}`)
    })
  })
const eased = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { eased: string[] }).eased)

async function hexatonicOnAndOff(page: Page): Promise<void> {
  await page.goto('/song/autumn-leaves')
  await chooseSheet(page, 'Scales')
  await pickOption(page, 'Where each scale starts', 'From root')
  await recordEasing(page)
  const preset = page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'Hexatonic', exact: true })
  await preset.click()
  await expect(page.getByRole('button', { name: 'Hexatonic pair' })).toBeVisible()
  await expect(page.locator('.ease-enter-active')).toHaveCount(0) // settled
  await preset.click()
  await expect(page.getByRole('button', { name: 'Hexatonic pair' })).toHaveCount(0)
}

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('the Hexatonic pickers grow in and collapse out, so what is below slides', async ({ page }) => {
    await hexatonicOnAndOff(page)
    expect(await eased(page)).toEqual(expect.arrayContaining(['enter grid-template-rows', 'enter opacity', 'leave grid-template-rows', 'leave opacity']))
  })

  test('a line’s detail (Line options) comes in beside the Line control: once it settles, nothing has moved', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/song/autumn-leaves')
    await chooseSheet(page, 'Changes')
    const line = page.locator('#preview-toolbar [data-slot=label]').getByText('Line', { exact: true })
    // where the label sits in the rail (not the viewport: the page can scroll as the sheet redraws)
    const place = async () => {
      const [l, r] = await Promise.all([line.boundingBox(), page.getByRole('group', { name: 'Sheet controls' }).boundingBox()])
      return { x: l!.x - r!.x, y: l!.y - r!.y }
    }
    const at = await place()
    await showLine(page, 'Guide Tones')
    await expect(page.locator('.ease-enter-active, .ease-leave-active')).toHaveCount(0)
    expect(await place()).toEqual(at)
  })
})

test('with reduced motion the pickers only fade', async ({ page }) => {
  await hexatonicOnAndOff(page)
  const seen = await eased(page)
  expect(seen).toEqual(expect.arrayContaining(['enter opacity', 'leave opacity']))
  expect(seen.filter((s) => !s.endsWith('opacity'))).toEqual([])
})
