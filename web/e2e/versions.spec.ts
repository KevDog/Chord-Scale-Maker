import { SITE_URL } from '../app/utils/site'
import { expect, staves, test, writeChart } from './fixtures'

// a tune with two library charts: Summertime and its Jazz Mind Accelerator version (#411)

test('the Library lists Summertime once, with its count of versions', async ({ page }) => {
  await page.goto('/library')
  await page.getByPlaceholder('Search by title').fill('summertime')
  await expect(page.getByRole('link', { name: 'Summertime', exact: true })).toHaveCount(1)
  await expect(page.getByRole('row', { name: /Summertime/ })).toContainText('2 versions')
})

test('the version picker switches between a tune\'s charts', async ({ page }) => {
  await page.goto('/song/summertime')
  await expect(staves(page).first()).toBeVisible()
  const picker = page.getByRole('button', { name: 'Version' })
  await expect(picker).toHaveAccessibleName('Version Main') // its value too (#425)
  await picker.click()
  await expect(page.getByRole('option')).toHaveText(['Main', 'Jazz Mind Accelerator'])
  await page.getByRole('option', { name: 'Jazz Mind Accelerator' }).click()
  await expect(page).toHaveURL(/\/song\/summertime-jazz-mind-accelerator$/)
  await expect(page.getByRole('button', { name: 'Version' })).toContainText('Jazz Mind Accelerator')
  await expect(staves(page).first()).toBeVisible()
  // the label stays in the heading and the tab once the app runs
  await expect(page.getByRole('heading', { name: 'Summertime (Jazz Mind Accelerator)', level: 1 })).toBeVisible()
  await expect(page).toHaveTitle(/^Summertime \(Jazz Mind Accelerator\)/)
})

test('your saved charts of a tune join its picker, under Mine, and open there', async ({ page }) => {
  await page.goto('/help')
  await page.evaluate(() => {
    localStorage.setItem('csm-charts', JSON.stringify([{ id: 'mysummer01', title: 'Summertime', kind: 'copy', basedOn: 'summertime', createdAt: 1, updatedAt: 1 }]))
    localStorage.setItem('csm-chart:mysummer01', 'title: Summertime\nversion: Ballad\nkey: Am\n\nsection: A\nbars: 4\n1 | Am6')
  })
  await page.goto('/song/summertime')
  await expect(staves(page).first()).toBeVisible()
  await page.getByRole('button', { name: 'Version' }).click()
  await expect(page.getByRole('option')).toHaveText(['Main', 'Jazz Mind Accelerator', 'Ballad'])
  await expect(page.getByRole('group', { name: 'Library' }).getByRole('option')).toHaveText(['Main', 'Jazz Mind Accelerator'])
  await expect(page.getByRole('group', { name: 'Mine' }).getByRole('option')).toHaveText(['Ballad'])
  await page.getByRole('option', { name: 'Ballad' }).click()
  await expect(page).toHaveURL(/\/song\?mine=mysummer01$/)
  await expect(page.getByRole('button', { name: 'Version' })).toContainText('Ballad')
  await page.getByRole('button', { name: 'Version' }).click()
  await page.getByRole('option', { name: 'Main' }).click()
  await expect(page).toHaveURL(/\/song\/summertime$/)
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/summertime`)
})

test('a saved chart titled by one of the tune\'s other titles joins its picker, under Mine (#426)', async ({ page }) => {
  await page.goto('/help')
  await page.evaluate(() => {
    localStorage.setItem('csm-charts', JSON.stringify([{ id: 'myleaves01', title: 'Les Feuilles mortes (copy)', kind: 'copy', createdAt: 1, updatedAt: 1 }]))
    localStorage.setItem('csm-chart:myleaves01', 'title: Les Feuilles mortes (copy)\nkey: Gm\n\nsection: A\nbars: 4\n1 | Cm7')
  })
  await page.goto('/song/autumn-leaves')
  await expect(staves(page).first()).toBeVisible()
  await page.getByRole('button', { name: 'Version' }).click()
  await expect(page.getByRole('group', { name: 'Mine' }).getByRole('option')).toHaveText(['My chart'])
})

test('the picker follows your chart as you write it: a new chart titled as a tune, then its version: line', async ({ page }) => {
  await writeChart(page, 'title: Summertime\nkey: Am\n\nsection: A\nbars: 4\n1 | Am6\n')
  const picker = page.getByRole('button', { name: 'Version' })
  await expect(picker).toContainText('My chart')
  await page.getByLabel('Chart text').fill('title: Summertime\nversion: Ballad\nkey: Am\n\nsection: A\nbars: 4\n1 | Am6\n')
  await expect(picker).toContainText('Ballad')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a version page is named by its label, and its canonical is the main chart', async ({ page }) => {
    await page.goto('/song/summertime-jazz-mind-accelerator')
    await expect(page.getByRole('heading', { name: 'Summertime (Jazz Mind Accelerator)', level: 1 })).toBeVisible()
    await expect(page).toHaveTitle(/^Summertime \(Jazz Mind Accelerator\)/)
    await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/summertime`)
  })

  test("a version's card is its own; its composition is the main chart's (#424)", async ({ page }) => {
    await page.goto('/song/summertime-jazz-mind-accelerator')
    await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', `${SITE_URL}/song/summertime-jazz-mind-accelerator`)
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').last().textContent()) ?? '[]') as { '@type': string; name?: string; url?: string }[]
    expect(ld[0]).toMatchObject({ '@type': 'MusicComposition', name: 'Summertime', url: `${SITE_URL}/song/summertime` })
  })
})

test('a version page keeps its canonical once the app runs', async ({ page }) => {
  await page.goto('/song/summertime-jazz-mind-accelerator')
  await expect(staves(page).first()).toBeVisible()
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/song/summertime`)
})

test('a tune of one chart shows no picker', async ({ page }) => {
  await page.goto('/song/blue-trane')
  await expect(staves(page).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Version' })).toHaveCount(0)
})
