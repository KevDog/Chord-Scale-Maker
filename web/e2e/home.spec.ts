import { chooseInstrument, expect, staves, test } from './fixtures'

const search = (page: import('@playwright/test').Page) => page.getByRole('combobox', { name: 'Search by title or composer' })

test('the home page opens the first suggestion on Enter', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'What are you playing?', level: 1 })).toBeVisible()
  await search(page).fill('stella by')
  await expect(page.getByRole('option').first()).toContainText('Stella by Starlight')
  await search(page).press('Enter')
  await expect(page).toHaveURL(/\/song\/stella-by-starlight$/)
  await expect(staves(page).first()).toBeVisible()
})

test('suggestions show each key written for the instrument the song page remembers', async ({ page }) => {
  await page.goto('/song/stella-by-starlight')
  await chooseInstrument(page, 'Tenor Sax')
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Instrument/ })).toContainText('Tenor Sax')
  await search(page).fill('stella by')
  await expect(page.getByRole('option').first()).toContainText('in C, concert B♭')
})

test('the last suggestion shows every match in the library', async ({ page }) => {
  await page.goto('/')
  await search(page).fill('blue')
  await page.getByRole('option', { name: /^See all \d+ in the library/ }).click()
  await expect(page).toHaveURL(/\/library\?q=blue$/)
  await expect(page.getByPlaceholder('Search by title')).toHaveValue('blue')
  await expect(page.getByRole('link', { name: 'Blue Bossa', exact: true }).first()).toBeVisible()
})

test('/ goes to the search', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'What are you playing?' })).toBeVisible()
  await expect(async () => {
    await page.locator('body').press('/')
    await expect(search(page)).toBeFocused({ timeout: 1000 })
  }).toPass({ timeout: 10_000 })
})

test('recently opened tunes are on the home page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Recently opened' })).toHaveCount(0)
  await page.goto('/song/autumn-leaves')
  await expect(staves(page).first()).toBeVisible()
  await page.goto('/')
  await page.getByRole('region', { name: 'Recently opened' }).getByRole('link', { name: 'Autumn Leaves' }).click()
  await expect(page).toHaveURL(/\/song\/autumn-leaves$/)
})

test('an old /#letter-R library link goes to the library', async ({ page }) => {
  await page.goto('/#letter-R')
  await expect(page).toHaveURL(/\/library#letter-R$/)
  await expect(page.getByRole('link', { name: 'Rapture', exact: true })).toBeInViewport()
})

test('the tune of the day opens its song, and Another picks a different one', async ({ page }) => {
  await page.goto('/')
  const totd = page.getByRole('region', { name: 'Tune of the day' })
  const link = totd.getByRole('link')
  const first = await link.getAttribute('href')
  await totd.getByRole('button', { name: 'Another tune' }).click()
  await expect(link).not.toHaveAttribute('href', first!)
  await link.click()
  await expect(page).toHaveURL(/\/song\/[a-z0-9-]+$/)
  await expect(staves(page).first()).toBeVisible()
})

test('on a phone the search has the box’s width and the instrument sits under it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const picker = page.getByRole('button', { name: /Instrument/ })
  await expect(picker).toBeVisible()
  const field = (await search(page).boundingBox())!
  const pick = (await picker.boundingBox())!
  expect(field.width).toBeGreaterThan(260)
  expect(pick.y).toBeGreaterThanOrEqual(field.y + field.height)
})
