import { chooseInterface, chooseSheet, expect, moreAction, setScaleLevel, test } from './fixtures'
import type { Browser, Page } from '@playwright/test'

// the Interface setting (#273): which controls show at Essentials, Intermediate and Everything
const level = (page: Page) => page.getByRole('button', { name: 'Level', exact: true })
const guideTones = (page: Page) => page.getByRole('radio', { name: 'Guide Tones', exact: true })
const numerals = (page: Page) => page.getByRole('button', { name: 'Numerals', exact: true })
const pentatonics = (page: Page) => page.getByRole('button', { name: 'Pentatonics', exact: true })
const practice = (page: Page) => page.locator('fieldset', { hasText: 'Practice' })
const spell = (page: Page) => page.getByRole('button', { name: 'Where each scale starts' })

test.describe('Essentials', () => {
  test.use({ interfaceLevel: 'essentials' })

  test('keeps the sheet, instrument and transposing, and hides the study controls until Intermediate is chosen', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await expect(page.getByRole('button', { name: 'Instrument' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Work on' })).toBeVisible()
    await expect(level(page)).toHaveCount(0)
    await expect(numerals(page)).toHaveCount(0)
    await expect(guideTones(page)).toHaveCount(0)
    await chooseSheet(page, 'Scales')
    await expect(page.getByRole('button', { name: 'Intervals' })).toBeVisible()
    await expect(practice(page)).toHaveCount(0)
    await expect(spell(page)).toHaveCount(0)
    await moreAction(page, 'Intermediate')
    await expect(level(page)).toBeVisible()
    await expect(practice(page)).toBeVisible()
    await page.reload()
    await expect(level(page)).toBeVisible() // remembered
  })
})

test.describe('Intermediate', () => {
  test.use({ interfaceLevel: 'intermediate' })

  test('adds the level, analysis, lines and Practice, not pentatonics', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await expect(level(page)).toBeVisible()
    await expect(numerals(page)).toBeVisible()
    await expect(guideTones(page)).toBeVisible()
    await expect(pentatonics(page)).toHaveCount(0)
    await chooseSheet(page, 'Scales')
    await expect(practice(page)).toBeVisible()
    await expect(practice(page).getByRole('button', { name: 'Pentatonic' })).toHaveCount(0)
  })
})

test.describe('Everything', () => {
  test('shows pentatonics', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await expect(pentatonics(page)).toBeVisible()
  })
})

test.describe('a new browser', () => {
  test.use({ interfaceLevel: null })

  test('starts at Essentials', async ({ page }) => {
    await page.goto('/song/autumn-leaves')
    await expect(page.getByRole('button', { name: 'Instrument' })).toBeVisible()
    await expect(level(page)).toHaveCount(0)
  })

  test('that already has preferences starts at Everything', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        if (localStorage.getItem('csm-interface') === null) localStorage.setItem('csm-instrument', 'concert')
      } catch {
        // no storage on this page
      }
    })
    await page.goto('/song/autumn-leaves')
    await expect(pentatonics(page)).toBeVisible()
  })
})

test.describe('a share link with hidden settings', () => {
  /** a link made at Everything with the Advanced level, opened in a new browser at Essentials */
  async function openAtEssentials(page: Page, browser: Browser): Promise<Page> {
    await page.goto('/song/autumn-leaves')
    await setScaleLevel(page, 'Advanced')
    await page.getByRole('button', { name: 'Share' }).click()
    const box = page.getByRole('dialog').getByLabel('Link')
    await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
    const link = await box.inputValue()
    const fresh = await browser.newContext()
    await chooseInterface(fresh, 'essentials')
    const visitor = await fresh.newPage()
    await visitor.goto(link)
    return visitor
  }
  const notice = (page: Page) => page.getByRole('status').filter({ hasText: 'This sheet uses Intermediate settings' })

  test('says so; Show controls raises the level', async ({ page, browser }) => {
    const visitor = await openAtEssentials(page, browser)
    await expect(notice(visitor)).toBeVisible()
    await notice(visitor).getByRole('button', { name: 'Show controls' }).click()
    await expect(level(visitor)).toHaveText(/Advanced/)
    await expect(notice(visitor)).toHaveCount(0)
  })

  test('Reset returns them to their defaults', async ({ page, browser }) => {
    const visitor = await openAtEssentials(page, browser)
    await notice(visitor).getByRole('button', { name: 'Reset' }).click()
    await expect(notice(visitor)).toHaveCount(0)
    await expect(level(visitor)).toHaveCount(0)
  })
})
