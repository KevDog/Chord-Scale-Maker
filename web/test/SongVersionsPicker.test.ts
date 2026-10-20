import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import SongVersions from '~/components/SongVersions.vue'
import { saveChart } from '~/utils/myCharts'

// the song page's version picker (#411, #425); its choices are tested in songVersions.test.ts
const open = async (w: Awaited<ReturnType<typeof mountSuspended>>) => {
  await w.find('button').trigger('click')
  await nextTick()
}
const groups = (w: Awaited<ReturnType<typeof mountSuspended>>) =>
  w.findAll('[role=group]').map((g) => [g.find('[role=presentation]').text(), g.findAll('[role=option]').map((o) => o.text())])

describe('SongVersions', () => {
  afterEach(() => localStorage.clear())

  it('names its button by "Version" and the version shown', async () => {
    const w = await mountSuspended(SongVersions, { props: { at: { slug: 'summertime' } }, attachTo: document.body })
    const button = w.find('button')
    const [label, self] = (button.attributes('aria-labelledby') ?? '').split(' ')
    expect(self).toBe(button.attributes('id'))
    expect(document.getElementById(label!)?.textContent).toBe('Version')
    expect(button.text()).toBe('Main')
    w.unmount()
  })

  it('lists the library\'s versions flat while you have none of the tune', async () => {
    const w = await mountSuspended(SongVersions, { props: { at: { slug: 'summertime' } }, attachTo: document.body })
    await open(w)
    expect(w.findAll('[role=option]').map((o) => o.text())).toEqual(['Main', 'Jazz Mind Accelerator'])
    expect(w.findAll('[role=group]')).toHaveLength(0)
    w.unmount()
  })

  it('groups them under Library beside your Mine', async () => {
    saveChart({ id: 'mysummer01', text: 'title: Summertime\nversion: Ballad\nkey: Am\n\nsection: A\nbars: 4\n1 | Am6', kind: 'copy', basedOn: 'summertime' }, 1)
    const w = await mountSuspended(SongVersions, { props: { at: { slug: 'summertime' } }, attachTo: document.body })
    await open(w)
    expect(groups(w)).toEqual([
      ['Library', ['Main', 'Jazz Mind Accelerator']],
      ['Mine', ['Ballad']],
    ])
    w.unmount()
  })
})
