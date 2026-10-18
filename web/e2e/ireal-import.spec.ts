import { expect, openEditor, test } from './fixtures'
import { irealLink } from '../../engine/src/ireal/__tests__/link'

const BLUES = '[*AT44C7 |F7 |C7 |C7 |F7 |F7 |C7 |A7 |D-7 |G7 |C7 A7 |D-7 G7 Z'
const one = irealLink([{ title: 'Blues for Test', composer: 'Doe Jane', music: BLUES }], undefined, true)
const two = irealLink([{ title: 'First', music: BLUES }, { title: 'Second', music: '[*AF^7 |x Z' }], 'Set', true)
const odd = irealLink([{ title: 'Odd One', music: '[*AC7(Db7) |F7 Z' }], undefined, true)

test('an iReal export opens from Open chart… as a new chart', async ({ page }) => {
  await page.goto('/library')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open chart…' }).click()
  await (await chooser).setFiles({ name: 'Blues.html', mimeType: 'text/html', buffer: Buffer.from(`<html><body><a href="${one}">Blues</a></body></html>`) })
  await expect(page).toHaveURL(/\/song\?mine=/)
  await expect(page.getByRole('heading', { name: 'Blues for Test', level: 1 })).toBeVisible()
})

test('a pasted playlist link asks which song, and a report waits for Open anyway', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Import iReal link…' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Link').fill(two)
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog.getByText('Set has 2 songs')).toBeVisible()
  await dialog.getByLabel('Song').selectOption({ label: 'Second' })
  await dialog.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('heading', { name: 'Second', level: 1 })).toBeVisible()

  await page.goto('/library')
  await page.getByRole('button', { name: 'Import iReal link…' }).click()
  await page.getByRole('dialog').getByLabel('Link').fill(odd)
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('dialog').getByText('the alternate chord Db7 is left out')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Open anyway' }).click()
  await expect(page.getByRole('heading', { name: 'Odd One', level: 1 })).toBeVisible()
})

test('a damaged link says so in the dialog', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Import iReal link…' }).click()
  await page.getByRole('dialog').getByLabel('Link').fill('irealb://%E0%A4%A')
  await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click()
  await expect(page.getByRole('dialog').getByText(/damaged/)).toBeVisible()
})

test('Paste bars takes an iReal link', async ({ page }) => {
  await page.goto('/song?new=1')
  await openEditor(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Edit G7, A bar 2' }).hover()
  await page.getByRole('button', { name: 'More actions for A bar 2' }).click()
  await page.getByRole('menuitem', { name: 'Paste bars…' }).click()
  const paste = page.getByRole('dialog')
  await paste.getByLabel('Bars').fill(irealLink([{ title: 'T', music: '[*AF-7 |Bb7 |Eb^7 Z' }]))
  await expect(paste.getByText('3 bars')).toBeVisible()
  await paste.getByRole('button', { name: 'Insert after bar 2' }).click()
  await expect.poll(async () => (await page.getByLabel('Chart text').inputValue()).replace(/[ \t]*\|[ \t]*/g, ' | ')).toMatch(/\n2 \| G7\n3 \| Fm7\n4 \| Bb7\n5 \| EbMaj7\n6 \| CMaj7/)
})
