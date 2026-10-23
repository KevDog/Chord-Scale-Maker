import { chooseInstrument, chooseInterface, chooseRhythm, chooseSheet, expect, pickOption, staves, test } from './fixtures'

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('a scale page is all there in its HTML: notes, what it plays over, the tunes', async ({ page }) => {
    await page.goto('/scales/dorian')
    await expect(page.getByRole('heading', { name: 'Dorian scale', level: 1 })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Dorian on C' }).getByRole('listitem')).toHaveCount(7)
    await expect(page.getByRole('list', { name: 'Dorian on C' })).toContainText('E♭')
    await expect(page.getByRole('region', { name: 'Plays over' })).toContainText('C–7')
    await expect(page.locator('main h2')).toHaveText(['Notes', 'Practice it', 'Plays over', 'Tunes'])
    const tunes = page.getByRole('region', { name: 'Tunes' }).getByRole('link')
    await expect(tunes.first()).toHaveAttribute('href', /^\/song\//)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://www.chordscalemaker.com/scales/dorian')
  })

  test('a scale no library tune plays at Standard says so', async ({ page }) => {
    await page.goto('/scales/diatonic-diminished-i-optional')
    await expect(page.getByText('No library tune plays it at the Standard level yet')).toBeVisible()
  })

  test('/scales lists every scale in the sitemap', async ({ page, request }) => {
    // the engine can't load under Playwright (its JSON import): the sitemap lists every scale page
    const xml = await (await request.get('/sitemap.xml')).text()
    const paths = [...xml.matchAll(/<loc>https:\/\/www\.chordscalemaker\.com(\/scales\/[^<]+)<\/loc>/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(30)
    await page.goto('/scales')
    await expect(page.getByRole('heading', { name: 'Scales', level: 1 })).toBeVisible()
    for (const p of paths) await expect(page.locator(`main a[href="${p}"]`)).toHaveCount(1)
  })
})

test('a scale page draws its staff, written for the instrument', async ({ page }) => {
  await page.goto('/scales/dorian')
  await expect(staves(page)).toHaveCount(1)
  const practice = page.getByRole('region', { name: 'Practice it' })
  await expect(practice).toContainText('C Dorian')
  await chooseInstrument(page, 'Tenor')
  await expect(practice).toContainText('D Dorian')
  await expect(practice.getByText('Spell Scale')).toHaveCount(0) // a reference page spells from the root
})

test.describe('an unknown scale', () => {
  test.use({ expectedConsoleError: /status of 404|NUXT_E1005/ })
  test('is not found', async ({ page }) => {
    const res = await page.goto('/scales/no-such-scale')
    expect(res?.status()).toBe(404)
  })
})

test('the footer and the Functions page link to the scales', async ({ page }) => {
  await page.goto('/functions')
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Scales' }).click()
  await expect(page.getByRole('heading', { name: 'Scales', level: 1 })).toBeVisible()
  await page.goto('/functions')
  await expect(page.locator('main a[href="/scales/dorian"]').first()).toBeVisible()
})

// a tuplet pulse (Phase 4 spec §2, §7; flag `rhythmGears`): a Units family at Everything, one 5:4 tuplet a card bar
test.describe('the Scales sheet’s tuplet pulses', () => {
  test('a quarter-note quintuplet card: one tuplet a bar, its number 5', async ({ page }) => {
    await page.goto('/song/f-blues')
    await chooseSheet(page, 'Scales')
    await expect(staves(page).first()).toBeVisible()
    await chooseRhythm(page, 'Quarter-note quintuplets', { In: 'In 5', Variation: 'with accents' })
    const card = page.locator('[data-slot=rhythm-card] svg').first()
    await expect(card.locator('[data-rhythm-bar]')).toHaveCount(1) // 5 in 5: the cycle is a bar
    await expect(card.locator('.vf-tuplet')).toHaveCount(1)
    await expect(card.locator('.vf-tuplet text')).toHaveText(String.fromCodePoint(0xe885)) // Bravura's tuplet 5
  })

  // Task 3.2: a quarter of the staff can't hold 24 sextuplet 16ths, which ran on under the next bar: a card bar takes
  // its notes' room, and the card shows the bars that fit, then "…"
  test('a sextuplet card in 7: wider bars, as many as fit, none running into the next, the tuplets apart', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('csm-rhythm', 'unit:16t:7:accents'))
    await page.goto('/song/f-blues')
    await chooseSheet(page, 'Scales')
    const card = page.locator('[data-slot=rhythm-card] svg').first()
    await expect(card).toHaveAttribute('aria-label', /^Rhythm card: Sextuplets in 7, with accents, [1-3] bars?, continues$/)
    const bars = await card.locator('[data-rhythm-bar]').count()
    await expect(card.locator('text', { hasText: '…' })).toHaveCount(1)
    await expect(card.locator('.vf-tuplet')).toHaveCount(4 * bars)
    const d = await card.evaluate((svg) => {
      const rect = (e: Element) => e.getBoundingClientRect()
      const groups = [...svg.querySelectorAll('[data-rhythm-bar]')]
      const tuplets = [...svg.querySelectorAll('.vf-tuplet')].map(rect).sort((a, b) => a.left - b.left)
      return {
        overlaps: tuplets.slice(1).filter((t, i) => t.left < tuplets[i]!.right - 1).length,
        // each bar's last note ends inside its own stave
        inside: groups.map((g) => Math.max(...[...g.querySelectorAll('.vf-stavenote')].map((n) => rect(n).right)) <= rect(g.querySelector('.vf-stave')!).right),
      }
    })
    expect(d.overlaps).toBe(0)
    expect(d.inside).toEqual(Array(bars).fill(true))
  })
})

// the Scales sheet's rhythm card (rhythm-scales-arpeggios spec §1, §6, §9; flag `rhythmSheets`)
test.describe('the Scales sheet’s rhythm', () => {
  test.use({ interfaceLevel: 'intermediate' })

  test('a rhythm card under each staff', async ({ page }) => {
    await page.goto('/song/f-blues')
    await chooseSheet(page, 'Scales')
    await expect(staves(page).first()).toBeVisible()
    await chooseRhythm(page, '8ths', { In: 'In 5', Variation: 'with accents' })
    const count = await page.locator('[data-slot=scale-staff]').count()
    expect(count).toBeGreaterThan(0)
    await expect(page.locator('[data-slot=scale-staff]:not(:has([data-slot=rhythm-card]))')).toHaveCount(0)
    await expect(page.locator('[data-slot=rhythm-card]')).toHaveCount(count)
    await expect(page.locator('section header p').first()).toContainText('Rhythm: 8ths in 5, with accents')
    // drawn: four bars of the five-bar cycle, "…", Saindon's bracket, the label; a time signature on every staff
    const cards = page.locator('[data-slot=rhythm-card] svg')
    await expect(cards).toHaveCount(count)
    for (const card of await cards.all()) {
      await expect(card.locator('[data-rhythm-bar]')).toHaveCount(4)
      await expect(card.locator('text', { hasText: '…' })).toHaveCount(1)
      await expect(card.locator('[data-rhythm-bracket]')).not.toHaveCount(0)
      await expect(card).toHaveAttribute('aria-label', 'Rhythm card: 8ths in 5, with accents, 4 bars, continues')
    }
    await expect(staves(page)).toHaveCount(count) // the cards aren't staves
    await expect(page.locator('[data-slot=scale-staff] svg[data-time-sig="4/4"]:not([data-slot=rhythm-card] svg)')).toHaveCount(count)
    // Off: today's staves, no card and no time signature
    await chooseRhythm(page, 'Off')
    await expect(page.locator('[data-slot=rhythm-card]')).toHaveCount(0)
    await expect(page.locator('svg[data-time-sig]')).toHaveCount(0)
    await expect(page.locator('[data-rhythm-bar]')).toHaveCount(0)
    await expect(staves(page)).toHaveCount(count)
  })

  // Notes per bar (spec §2, §7, D15): the run in bars of N, the time signature on; practice and the intervals by staff note
  test('notes per bar draws the run in bars, its lit notes repeating on the way down', async ({ page }) => {
    await page.goto('/song/f-blues')
    await chooseSheet(page, 'Scales')
    await pickOption(page, 'Where each scale starts', 'From root')
    const panel = page.locator('fieldset', { hasText: 'Practice' })
    for (const box of [/^1$/, /^3$/, /^5$/]) await panel.locator('label', { hasText: box }).first().click()
    const first = staves(page).first()
    await expect(first).toHaveAttribute('aria-label', /; practice:/)
    const lit = await staves(page).evaluateAll((els) => els.map((e) => e.querySelectorAll('.vf-selected').length))
    expect(lit.every((n) => n > 0)).toBe(true)
    await pickOption(page, 'Notes per bar', '4 a bar')
    await expect(page.getByRole('button', { name: 'Notes per bar' })).toHaveText('Notes per bar: 4 a bar')
    await expect(first).toHaveAttribute('data-time-sig', '4/4')
    await expect(first.locator('.vf-stave')).toHaveCount(4)
    // every lit staff note twice (up, then down), and the root a third time (the top)
    await expect.poll(() => staves(page).evaluateAll((els) => els.map((e) => e.querySelectorAll('.vf-selected').length))).toEqual(lit.map((n) => 2 * n + 1))
    // its label names the run's notes and the last bar's rest, then the lit ones in run order
    const [names, practice] = ((await first.getAttribute('aria-label')) ?? '').split('; practice: ')
    expect(names?.split(' ')).toHaveLength(16)
    expect(names).toMatch(/ rest$/)
    expect(practice?.split(' ')).toHaveLength(2 * (lit[0] ?? 0) + 1)
    // the intervals: one label a run note
    await expect(page.locator('[data-slot=scale-staff]').first().locator('p span:not(.sr-only)')).toHaveCount(15)
    // Whole notes: today's staves again
    await pickOption(page, 'Notes per bar', 'Whole notes')
    await expect(page.locator('svg[data-time-sig]')).toHaveCount(0)
  })

  // a run poured into a Rhythm (spec §3, §7): its label names the rhythm after the notes; an evenly filled run's doesn't
  test('a run poured into a Rhythm names it in its label', async ({ page }) => {
    await page.goto('/song/f-blues')
    await chooseSheet(page, 'Scales')
    await pickOption(page, 'Notes per bar', '4 a bar')
    const first = staves(page).first()
    await expect(first).toHaveAttribute('data-time-sig', '4/4')
    await expect(first).not.toHaveAttribute('aria-label', /; rhythm: /)
    await chooseRhythm(page, '8ths', { In: 'In 3', Variation: 'with accents' })
    await expect(first).toHaveAttribute('aria-label', /^[^;]+ rest; rhythm: 8ths in 3, with accents$/)
  })

  test('a share link carries Notes per bar', async ({ page, browser }) => {
    await page.goto('/song/f-blues')
    await chooseSheet(page, 'Scales')
    await pickOption(page, 'Notes per bar', '5 a bar')
    await page.getByRole('button', { name: 'Share' }).click()
    const box = page.getByRole('dialog').getByLabel('Link')
    await expect(box).toHaveValue(/\/song#s=[A-Za-z0-9_-]+$/)
    const link = await box.inputValue()
    const fresh = await browser.newContext() // fresh storage: the link alone carries it
    await chooseInterface(fresh, 'intermediate')
    const visitor = await fresh.newPage()
    await visitor.goto(link)
    await expect(visitor.getByRole('button', { name: 'Notes per bar' })).toHaveText('Notes per bar: 5 a bar')
    await expect(staves(visitor).first()).toHaveAttribute('data-time-sig', '4/4')
    await fresh.close()
  })
})
