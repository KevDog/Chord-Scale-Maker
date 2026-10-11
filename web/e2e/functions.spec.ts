import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { Page } from '@playwright/test'
import { chooseInstrument, expect, test, writeChart } from './fixtures'

// the engine can't be imported here (its JSON import needs a bundler), so read the ids from the RULES table's source,
// found through the package (engine/ in the workspace)
const ENGINE = pathToFileURL(createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json'))
const RULE_IDS = Array.from(
  (readFileSync(new URL('src/analysis/rules.ts', ENGINE), 'utf8').split('export const RULES')[1] ?? '').matchAll(/^\s*\{ id: '([^']+)'/gm),
  (m) => m[1] as string,
)

/** a new chart is saved a moment after it is written and the address then becomes ?mine=: wait, or that rewrite undoes a navigation */
const saved = (page: Page) => expect(page).toHaveURL(/[?&]mine=/)

const CHART = 'title: T\nkey: C\nA | 1 | Dm7\nA | 2 | G7\nA | 3 | CMaj7\n'

test('the functions page renders its four sections and the C major table', async ({ page }) => {
  await page.goto('/functions')
  for (const id of ['writing', 'table', 'rules', 'report']) await expect(page.locator(`#${id}`)).toBeVisible()
  await expect(page.getByRole('row', { name: /V7\/ii\s+A7\s+A Mixolydian ♭6/ })).toBeVisible()
})

test('every rule has an anchor', async ({ page }) => {
  await page.goto('/functions')
  expect(RULE_IDS.length).toBeGreaterThan(20)
  for (const id of RULE_IDS) await expect(page.locator(`#rule-${id}`), id).toHaveCount(1)
})

test('without JavaScript the table and the rule anchors are in the page', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/functions#rule-m4')
  await expect(page.locator('#rule-m4')).toBeVisible()
  await expect(page.getByRole('row', { name: /subV7\s+D♭7/ })).toBeVisible()
  await context.close()
})

test('the key picker recomputes the table and keeps the key in the link', async ({ page }) => {
  await page.goto('/functions')
  await page.getByRole('button', { name: 'Key' }).click()
  await page.getByRole('option', { name: /E♭ major/ }).click()
  await expect(page).toHaveURL(/[?&]key=Eb/)
  await expect(page.getByRole('row', { name: /V7\/V\s+F7/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('row', { name: /V7\/V\s+F7/ })).toBeVisible()
})

test('a bad key in the link falls back to C major', async ({ page }) => {
  await page.goto('/functions?key=H')
  await expect(page).toHaveURL(/[?&]key=C$/)
  await expect(page.getByRole('row', { name: /V7\/V\s+D7/ })).toBeVisible()
})

test('a rule link from the Changes sheet lands on its row', async ({ page }) => {
  await writeChart(page, CHART)
  await saved(page)
  await page.getByRole('button', { name: 'ii7' }).first().click()
  await page.getByRole('dialog', { name: 'Why: Dm7' }).getByRole('link', { name: 'm4' }).click()
  await expect(page).toHaveURL(/\/functions#rule-m4$/)
  await expect(page.locator('#rule-m4')).toBeInViewport()
})

test('Report issue copies the report and offers the contact form and GitHub', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await writeChart(page, CHART)
  await saved(page)
  await page.getByRole('button', { name: 'ii7' }).first().click()
  const note = page.getByRole('dialog', { name: 'Why: Dm7' })
  const copy = note.getByRole('button', { name: 'Report issue' })
  await expect(copy).toHaveAttribute('data-ready', 'true') // the share link is made as the note opens
  await copy.click()
  await expect(note.getByRole('status')).toHaveText('Copied.')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('Chord: Dm7')
  expect(copied).toContain('Rule: m4')
  expect(copied).toMatch(/Link: http.*\/song#s=/)
  await expect(note.getByRole('link', { name: 'Open a GitHub issue' })).toHaveAttribute('href', /^https:\/\/github\.com\/KevDog\/Chord-Scale-Maker\/issues\/new\?title=/)
  await note.getByRole('button', { name: 'Send it with the contact form' }).click()
  await expect(page).toHaveURL(/\/contact$/)
  await expect(page.getByLabel('Message')).toHaveValue(/Rule: m4/)
})

test('on a transposing part the note names the chord as drawn, and the report says which lines are written', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await writeChart(page, CHART)
  await saved(page)
  await chooseInstrument(page, 'Trumpet')
  await page.getByRole('button', { name: 'V7', exact: true }).first().click()
  const note = page.getByRole('dialog', { name: 'Why: A7' })
  const copy = note.getByRole('button', { name: 'Report issue' })
  await expect(copy).toHaveAttribute('data-ready', 'true')
  await copy.click()
  await expect(note.getByRole('status')).toHaveText('Copied.')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('Instrument: B♭ Trumpet\nBar: 2 (section A)\nChord: A7 (concert G7)\n')
  expect(copied).toContain('Key area (written for B♭ Trumpet): D major')
  expect(copied).toContain(', in concert pitch')
})

test('on a phone the note fits the screen, wherever its numeral sits on the line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await writeChart(page, CHART)
  await saved(page)
  const numerals = page.getByRole('button', { name: /^(ii7|V7|Imaj7)$/ })
  const count = await numerals.count()
  expect(count).toBeGreaterThanOrEqual(3)
  for (const i of [0, 1, count - 1]) {
    await numerals.nth(i).click()
    const note = page.getByRole('dialog', { name: /^Why: / })
    await expect(note).toBeVisible()
    await expect.poll(async () => {
      const box = await note.boundingBox()
      return box !== null && box.x >= 0 && box.x + box.width <= 390
    }, `numeral ${i}`).toBe(true)
    await page.keyboard.press('Escape')
    await expect(note).toBeHidden()
  }
})

test('on a phone the note is reachable by keyboard and closes on Escape and outside clicks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await writeChart(page, CHART)
  await saved(page)
  await page.getByRole('button', { name: 'ii7' }).first().click()
  const note = page.getByRole('dialog', { name: 'Why: Dm7' })
  await expect(note).toBeVisible()
  const link = note.getByRole('link', { name: 'm4' })
  for (let i = 0; i < 5 && !(await link.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(link).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(note).toBeHidden()
  await page.getByRole('button', { name: 'ii7' }).first().click()
  await expect(note).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(note).toBeHidden()
})

test('the editor links to how to write a function', async ({ page }) => {
  await writeChart(page, 'title: T\nkey: C\nA | 1 | D7 | | X7\n')
  await saved(page)
  await expect(page.getByRole('link', { name: 'How to write a function' }).first()).toBeVisible()
  await page.getByRole('link', { name: 'How to write a function' }).first().click()
  await expect(page).toHaveURL(/\/functions#writing$/)
})

test('printed, the tables keep their borders', async ({ page }) => {
  await page.goto('/functions')
  await page.emulateMedia({ media: 'print' })
  const cell = page.locator('section[aria-labelledby="table"] td').first()
  await expect(cell).toHaveCSS('border-top-style', 'solid')
})
