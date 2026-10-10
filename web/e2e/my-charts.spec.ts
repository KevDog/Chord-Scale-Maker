import { chooseInstrument, expect, openEditor, pickOption, test } from './fixtures'

const status = (page: import('@playwright/test').Page) => page.getByRole('status').filter({ hasText: /in this browser|Saving/ })

test('a new chart saves itself, gets its own address, and is listed in My charts', async ({ page }) => {
  await page.goto('/song?new=1')
  await page.getByLabel('chord for row 1', { exact: true }).fill('F7')
  await expect(status(page)).toHaveText(/^Saved in this browser at/)
  await expect(page).toHaveURL(/\/song\?mine=[a-f0-9]{12}$/)
  await expect(page.getByLabel('chord for row 1', { exact: true })).toBeFocused() // the editor didn't restart
  await page.reload()
  await openEditor(page) // after reload it's a saved chart: song-first, so reopen the editor
  await expect(page.getByLabel('chord for row 1', { exact: true })).toHaveValue('F7')
  await page.goto('/')
  const mine = page.getByRole('region', { name: 'My charts' })
  await expect(mine.getByRole('row', { name: /Untitled/ })).toContainText('Mine')
})

test('edits to a library chart are kept as your version, until you revert', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await expect(status(page)).toHaveText('Edits are saved in this browser as your version.')
  await openEditor(page)
  await page.getByLabel('chord for row 1', { exact: true }).fill('Cm9')
  await expect(status(page)).toHaveText(/^Your edited version of Autumn Leaves, saved in this browser/)
  await page.reload()
  await expect(page.getByLabel('chord for row 1', { exact: true })).toHaveValue('Cm9')
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'My charts' }).getByRole('row', { name: /Autumn Leaves/ })).toContainText('Edited')
  await page.getByRole('region', { name: 'My charts' }).getByRole('link', { name: 'Autumn Leaves' }).click()
  await page.getByRole('button', { name: 'Revert to library version' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Revert' }).click()
  await expect(page.getByLabel('chord for row 1', { exact: true })).toHaveValue('Cm7')
  await expect(page.getByRole('button', { name: 'Revert to library version' })).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'My charts' })).toHaveCount(0)
})

test('Save as a copy keeps a variation beside your version, and Delete removes one', async ({ page }) => {
  await page.goto('/song?chart=so_what')
  await page.getByRole('button', { name: 'Save as a copy' }).click()
  await expect(page).toHaveURL(/\/song\?mine=/)
  await expect(page.getByRole('heading', { name: 'So What (copy)', level: 1 })).toBeVisible()
  await page.goto('/')
  const mine = page.getByRole('region', { name: 'My charts' })
  await expect(mine.getByRole('row', { name: /So What \(copy\)/ })).toContainText('Copy')
  await mine.getByRole('button', { name: 'Delete So What (copy)' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('region', { name: 'My charts' })).toHaveCount(0)
})

test('a chart that isn’t saved here says so', async ({ page }) => {
  await page.goto('/song?mine=doesnotexist')
  await expect(page.getByRole('heading', { name: 'That chart isn’t here' })).toBeVisible()
})

test('Download saves the chart as text, scales included, and Open brings it back as a new chart', async ({ page }) => {
  await page.goto('/song?chart=blue_bossa')
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download' }).click()
  const file = await downloading
  expect(file.suggestedFilename()).toBe('Blue Bossa.txt')
  const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'))
  expect(text).toContain('A | 6  | G7#5#9 | G Altered')
  await page.goto('/')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open chart…' }).click()
  await (await chooser).setFiles({ name: 'Blue Bossa.txt', mimeType: 'text/plain', buffer: Buffer.from(text.replace('title: Blue Bossa', 'title: Blue Bossa (mine)')) })
  await expect(page).toHaveURL(/\/song\?mine=/)
  await expect(page.getByRole('heading', { name: 'Blue Bossa (mine)', level: 1 })).toBeVisible()
  await openEditor(page)
  await expect(page.getByLabel('Chart text')).toHaveValue(/G7#5#9 \| G Altered/) // the scale choices came with it
})

test('a file dropped on the library opens, and a wrong one says why', async ({ page }) => {
  await page.goto('/')
  const drop = async (name: string, body: string, type: string) => {
    const dt = await page.evaluateHandle(([n, b, t]) => {
      const d = new DataTransfer()
      d.items.add(new File([b ?? ''], n ?? '', { type: t ?? '' }))
      return d
    }, [name, body, type])
    await page.getByRole('heading', { name: 'Chart library' }).dispatchEvent('drop', { dataTransfer: dt })
  }
  await drop('photo.png', 'x', 'image/png')
  await expect(page.getByRole('alert')).toHaveText('Please open a chart saved as a .txt file.')
  await drop('tune.txt', 'title: Dropped\nA | 1 | Cm7\n', 'text/plain')
  await expect(page.getByRole('heading', { name: 'Dropped', level: 1 })).toBeVisible()
})

test('a share link carries the chart and the view to a browser that has never seen it', async ({ page, browser }) => {
  await page.goto('/song?chart=autumn_leaves')
  await openEditor(page)
  await page.getByLabel('chord for row 1', { exact: true }).fill('Cm9')
  await chooseInstrument(page, 'Tenor')
  await pickOption(page, 'Where each scale starts', 'From C')
  await page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'All' }).click()
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
  const link = await box.inputValue()
  expect(link.length).toBeLessThan(2_000)

  const other = await browser.newContext() // fresh storage: nothing saved there
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(visitor.getByRole('status').filter({ hasText: 'A shared chart' })).toBeVisible()
  await openEditor(visitor)
  await expect(visitor.getByLabel('chord for row 1', { exact: true })).toHaveValue('Cm9')
  await expect(visitor.locator('section header p').first()).toHaveText(/Tenor Sax \(Bb\) \(Spelled from C\)/)
  await expect(visitor.locator('.vf-selected').first()).toBeAttached() // the practice picks came too
  await visitor.getByRole('banner').getByRole('link', { name: 'Library' }).click()
  await visitor.getByRole('link', { name: 'New chart' }).click() // a new chart, not the shared one again
  await expect(visitor.getByLabel('chord for row 1', { exact: true })).toHaveValue('Dm7')
  await visitor.goBack() // the library
  await visitor.goBack() // the shared chart again
  await expect(visitor.getByLabel('chord for row 1', { exact: true })).toHaveValue('Cm9')
  await visitor.getByRole('button', { name: 'Save to My charts' }).click()
  await expect(visitor).toHaveURL(/\/song\?mine=/)
  await visitor.goto('/song?chart=so_what')
  await expect(visitor.locator('section header p').first()).not.toContainText('Tenor') // the link didn't change their own settings
  await visitor.goto('/')
  await expect(visitor.getByRole('region', { name: 'My charts' }).getByRole('link', { name: 'Autumn Leaves' })).toBeVisible()
  await other.close()
})

test('a damaged share link says so', async ({ page }) => {
  await page.goto('/song#s=not-a-real-chart')
  await expect(page.getByRole('heading', { name: 'That link doesn’t open a chart' })).toBeVisible()
})

test('choosing a scale and then the usual one again writes the scale name, and leaves the library chart unedited', async ({ page }) => {
  await page.goto('/song?chart=autumn_leaves')
  await openEditor(page)
  const scale = page.getByLabel('Scale for Cm7').first()
  await scale.selectOption('C Aeolian')
  await expect(status(page)).toHaveText(/^Your edited version of Autumn Leaves/)
  await scale.selectOption('')
  await expect(page.getByLabel('Chart text')).toHaveValue(/A1 \| 1 +\| Cm7 +\| C Dorian/) // the name, not an empty cell
  await expect(status(page)).toHaveText('Edits are saved in this browser as your version.') // back to the library version
  await expect(page.getByRole('button', { name: 'Revert to library version' })).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'My charts' })).toHaveCount(0)
})
