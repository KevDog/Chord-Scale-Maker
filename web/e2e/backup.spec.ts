import { chooseInterface, expect, test, typeChord } from './fixtures'

const menu = async (page: import('@playwright/test').Page, item: string) => {
  await page.getByRole('button', { name: 'Backup' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('Back up saves everything in one file, and Restore brings it into a new browser', async ({ page, browser }) => {
  await page.goto('/song?new=1')
  await typeChord(page, 'A', 1, 'Dm7', 'F7')
  await expect(page).toHaveURL(/\/song\?mine=[a-f0-9]{12}$/)
  await page.goto('/library')
  await page.evaluate(() => localStorage.setItem('csm-instrument', 'tenor-sax'))
  const downloading = page.waitForEvent('download')
  await menu(page, 'Back up…')
  const file = await downloading
  expect(file.suggestedFilename()).toMatch(/^chord-scale-maker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'))
  expect(JSON.parse(text)).toMatchObject({ format: 'csm-backup', v: 1, preferences: { 'csm-instrument': 'tenor-sax' } })

  // the same browser: nothing to do
  const again = page.waitForEvent('filechooser')
  await menu(page, 'Restore from backup…')
  await (await again).setFiles({ name: file.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(text) })
  await expect(page.getByRole('dialog')).toContainText('Everything in this backup is already here.')
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Restore' })).toBeDisabled()

  const other = await browser.newContext() // fresh storage
  await chooseInterface(other, 'everything')
  const fresh = await other.newPage()
  await fresh.goto('/library')
  await expect(fresh.getByRole('region', { name: 'My charts' })).toHaveCount(0)
  const chooser = fresh.waitForEvent('filechooser')
  await menu(fresh, 'Restore from backup…')
  await (await chooser).setFiles({ name: file.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(text) })
  const dialog = fresh.getByRole('dialog')
  await expect(dialog).toContainText('Charts: 1 new chart')
  await expect(dialog.getByRole('checkbox', { name: /Use the backup’s preferences/ })).toBeChecked()
  await dialog.getByRole('button', { name: 'Restore' }).click()
  await expect(dialog.getByRole('heading', { name: 'Restored' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Reload' }).click()
  await expect(fresh.getByRole('region', { name: 'My charts' }).getByRole('row', { name: /Untitled/ })).toBeVisible()
  await expect.poll(() => fresh.evaluate(() => localStorage.getItem('csm-instrument'))).toBe('tenor-sax')
  await other.close()
})
