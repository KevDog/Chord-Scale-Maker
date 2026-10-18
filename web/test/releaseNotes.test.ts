import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES } from '~/utils/releaseNotes'
import ReleaseNotes from '~/pages/release-notes.vue'

describe('RELEASE_NOTES', () => {
  it('runs newest first, a date at most once', () => {
    const dates = RELEASE_NOTES.map((n) => n.date)
    for (const d of dates) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(new Set(dates).size).toBe(dates.length)
  })

  it('has a sentence for every change, and a real PR number where it names one', () => {
    for (const n of RELEASE_NOTES) {
      expect(n.items.length, n.date).toBeGreaterThan(0)
      for (const i of n.items) {
        expect(i.text, n.date).toMatch(/\S.*\.$/)
        if (i.pr !== undefined) expect(Number.isInteger(i.pr) && i.pr > 0, `${n.date} ${i.text}`).toBe(true)
      }
    }
  })
})

describe('the release notes page', () => {
  it('has a section per date, its id the date, each change linking its PR', async () => {
    const page = await mountSuspended(ReleaseNotes)
    expect(page.findAll('[data-release]').map((s) => s.attributes('data-release'))).toEqual(RELEASE_NOTES.map((n) => n.date))
    const first = RELEASE_NOTES[0]!
    expect(page.find(`[id="${first.date}"]`).exists()).toBe(true)
    const pr = first.items.find((i) => i.pr)!.pr
    expect(page.find(`a[href="https://github.com/KevDog/Chord-Scale-Maker/pull/${pr}"]`).text()).toBe(`#${pr}`)
  })

  it('writes the date out', async () => {
    const page = await mountSuspended(ReleaseNotes)
    expect(page.find('[id="2026-10-18"]').text()).toBe('18 October 2026')
  })
})
