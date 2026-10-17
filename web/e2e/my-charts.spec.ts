import { chooseInstrument, chooseInterface, chooseSheet, expect, moreAction, openEditor, pickOption, sheetChord, test, typeChord } from './fixtures'

const status = (page: import('@playwright/test').Page) => page.getByRole('status').filter({ hasText: /in this browser|Saving/ })

test('a new chart saves itself, gets its own address, and is listed in My charts', async ({ page }) => {
  await page.goto('/song?new=1')
  await typeChord(page, 'A', 1, 'Dm7', 'F7')
  await expect(status(page)).toHaveText(/^Saved in this browser at/)
  await expect(page).toHaveURL(/\/song\?mine=[a-f0-9]{12}$/)
  await expect(sheetChord(page, 'F7', 'A', 1)).toBeFocused() // the editor didn't restart
  await page.reload()
  await openEditor(page) // after reload it's a saved chart: song-first, so reopen the editor
  await expect(sheetChord(page, 'F7', 'A', 1)).toBeVisible()
  await page.goto('/library')
  const mine = page.getByRole('region', { name: 'My charts' })
  await expect(mine.getByRole('row', { name: /Untitled/ })).toContainText('Mine')
})

test('edits to a library chart are kept as your version, until you revert', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await expect(status(page)).toHaveText('Edits are saved in this browser as your version.')
  await openEditor(page)
  await typeChord(page, 'A1', 1, 'Cm7', 'Cm9')
  await expect(status(page)).toHaveText(/^Your edited version of Autumn Leaves, saved in this browser/)
  await page.reload()
  await expect(sheetChord(page, 'Cm9', 'A1', 1)).toBeVisible()
  await page.goto('/library')
  await expect(page.getByRole('region', { name: 'My charts' }).getByRole('row', { name: /Autumn Leaves/ })).toContainText('Edited')
  const edited = page.getByRole('region', { name: 'My charts' }).getByRole('link', { name: 'Autumn Leaves' })
  await expect(edited).toHaveAttribute('href', '/song/autumn-leaves') // your version lives at the library chart's address
  await edited.click()
  await moreAction(page, 'Revert to library version')
  await page.getByRole('dialog').getByRole('button', { name: 'Revert' }).click()
  await expect(sheetChord(page, 'Cm7', 'A1', 1)).toBeVisible()
  await page.getByRole('button', { name: 'More actions', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Revert to library version' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto('/library')
  await expect(page.getByRole('region', { name: 'My charts' })).toHaveCount(0)
})

test('Save as a copy keeps a variation beside your version, and Delete removes one', async ({ page }) => {
  await page.goto('/song/so-what')
  await moreAction(page, 'Save as a copy')
  await expect(page).toHaveURL(/\/song\?mine=/)
  await expect(page.getByRole('heading', { name: 'So What (copy)', level: 1 })).toBeVisible()
  await page.goto('/library')
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

test('Download saves the chart as text, and Open brings it back as a new chart', async ({ page }) => {
  await page.goto('/song/blue-bossa')
  const downloading = page.waitForEvent('download')
  await moreAction(page, 'Download')
  const file = await downloading
  expect(file.suggestedFilename()).toBe('Blue Bossa.txt')
  const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'))
  expect(text).toMatch(/\n6 +\| G7#5#9 +# /m) // as the library has it: the analysis chooses the scale
  await page.goto('/library')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open chart…' }).click()
  await (await chooser).setFiles({ name: 'Blue Bossa.txt', mimeType: 'text/plain', buffer: Buffer.from(text.replace('title: Blue Bossa', 'title: Blue Bossa (mine)')) })
  await expect(page).toHaveURL(/\/song\?mine=/)
  await expect(page.getByRole('heading', { name: 'Blue Bossa (mine)', level: 1 })).toBeVisible()
  await openEditor(page)
  await expect(page.getByLabel('Chart text')).toHaveValue(/\n6 +\| G7#5#9 +# /)
})

test('a file dropped on the library opens, and a wrong one says why', async ({ page }) => {
  await page.goto('/library')
  const drop = async (name: string, body: string, type: string) => {
    const dt = await page.evaluateHandle(([n, b, t]) => {
      const d = new DataTransfer()
      d.items.add(new File([b ?? ''], n ?? '', { type: t ?? '' }))
      return d
    }, [name, body, type])
    await page.getByRole('heading', { name: 'Library', level: 1 }).dispatchEvent('drop', { dataTransfer: dt })
  }
  await drop('photo.png', 'x', 'image/png')
  await expect(page.getByRole('alert')).toHaveText('Please open a chart saved as a .txt file.')
  await drop('tune.txt', 'title: Dropped\n\nsection: A\nbars: 4\n1 | Cm7\n', 'text/plain')
  await expect(page.getByRole('heading', { name: 'Dropped', level: 1 })).toBeVisible()
})

test('a share link carries the chart and the view to a browser that has never seen it', async ({ page, browser }) => {
  await page.goto('/song/autumn-leaves')
  await openEditor(page)
  await typeChord(page, 'A1', 1, 'Cm7', 'Cm9') // on the Changes sheet, the editor
  await chooseSheet(page, 'Scales') // From C and the practice picks are the scale sheet's; the link carries the sheet
  await chooseInstrument(page, 'Tenor')
  await pickOption(page, 'Where each scale starts', 'From C')
  await page.locator('fieldset', { hasText: 'Practice' }).getByRole('button', { name: 'All' }).click()
  await page.getByRole('button', { name: 'Share' }).click()
  const box = page.getByRole('dialog').getByLabel('Link')
  await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
  const link = await box.inputValue()
  expect(link.length).toBeLessThan(2_000)

  const other = await browser.newContext() // fresh storage: nothing saved there
  await chooseInterface(other, 'everything')
  const visitor = await other.newPage()
  await visitor.goto(link)
  await expect(visitor.getByRole('status').filter({ hasText: 'A shared chart' })).toBeVisible()
  await openEditor(visitor)
  await expect(visitor.getByLabel('Chart text')).toHaveValue(/\n1 +\| Cm9/)
  await expect(visitor.locator('section header p').first()).toHaveText(/Tenor Sax \(Bb\) \(Spelled from C\)/)
  await expect(visitor.locator('.vf-selected').first()).toBeAttached() // the practice picks came too
  await visitor.getByRole('banner').getByRole('link', { name: 'Library' }).click()
  await visitor.getByRole('link', { name: 'New chart' }).click() // a new chart, not the shared one again
  await expect(sheetChord(visitor, 'Dm7', 'A', 1)).toBeVisible()
  await visitor.goBack() // the library
  await visitor.goBack() // the shared chart again
  await expect(visitor.getByLabel('Chart text')).toHaveValue(/\n1 +\| Cm9/)
  await visitor.getByRole('button', { name: 'Save to My charts' }).click()
  await expect(visitor).toHaveURL(/\/song\?mine=/)
  await visitor.goto('/song/so-what')
  await expect(visitor.locator('section header p').first()).not.toContainText('Tenor') // the link didn't change their own settings
  await visitor.goto('/library')
  await expect(visitor.getByRole('region', { name: 'My charts' }).getByRole('link', { name: 'Autumn Leaves' })).toBeVisible()
  await other.close()
})

test('a damaged share link says so', async ({ page }) => {
  await page.goto('/song#s=not-a-real-chart')
  await expect(page.getByRole('heading', { name: 'That link doesn’t open a chart' })).toBeVisible()
})

test('choosing a scale and then the analysed one again leaves the library chart unedited; choosing it by name pins it', async ({ page }) => {
  await page.goto('/song/autumn-leaves')
  await openEditor(page)
  const scaleList = async () => {
    await page.getByRole('button', { name: 'C Dorian', exact: true }).first().click() // Cm7's scale label on the sheet
    return page.getByRole('dialog', { name: 'Scale: Cm7' })
  }
  const list = await scaleList()
  await list.getByRole('radio', { name: /^C Aeolian/ }).click()
  await expect(status(page)).toHaveText(/^Your edited version of Autumn Leaves/)
  await list.getByRole('radio', { name: /^C Dorian 1/ }).click() // the analysed option: blanks the cell, as the library has it
  await expect(page.getByLabel('Chart text')).toHaveValue(/\n1 +\| Cm7 +#/)
  await expect(status(page)).toHaveText('Edits are saved in this browser as your version.') // back to the library version
  await page.getByRole('button', { name: 'More actions', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Revert to library version' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.goto('/library')
  await expect(page.getByRole('region', { name: 'My charts' })).toHaveCount(0)
  await page.goto('/song/autumn-leaves')
  await openEditor(page)
  const again = await scaleList()
  await again.getByRole('searchbox', { name: 'Any scale' }).fill('C dor')
  await again.getByRole('list', { name: 'Scales found' }).getByRole('button', { name: /^C Dorian \d/ }).click()
  await expect(page.getByLabel('Chart text')).toHaveValue(/\n1 +\| Cm7 +\| C Dorian/) // the name pins it, though the analyser agrees
  await expect(status(page)).toHaveText(/^Your edited version of Autumn Leaves/)
})

test('an edited library chart and its scale level, saved under the chart’s old name, still open', async ({ page }) => {
  await page.goto('/help')
  await page.evaluate(() => {
    localStorage.setItem('csm-charts', JSON.stringify([{ id: 'oldname01', title: 'My Leaves', kind: 'edited', basedOn: 'autumn_leaves', createdAt: 1, updatedAt: 1 }]))
    localStorage.setItem('csm-chart:oldname01', 'title: My Leaves\nkey: Gm\n\nsection: A\nbars: 4\n1 | Cm7')
    localStorage.setItem('csm-level:autumn_leaves', JSON.stringify({ level: 'advanced', seed: 1 }))
  })
  await page.goto('/song/autumn-leaves')
  await expect(page).toHaveTitle('My Leaves · Chord Scale Maker')
  expect(await page.evaluate(() => [localStorage.getItem('csm-level:autumn_leaves'), JSON.parse(localStorage.getItem('csm-level:autumn-leaves') ?? '{}').level]))
    .toEqual([null, 'advanced'])
})
