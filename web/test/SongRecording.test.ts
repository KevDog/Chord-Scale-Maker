import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import SongRecording from '~/components/SongRecording.vue'

const recording = { artist: 'John Coltrane', album: 'Blue Train', label: 'Blue Note', year: '1958' }
const mount = (youtube = '', embeddable = true) => mountSuspended(SongRecording, { props: { recording, youtube, embeddable, title: 'Blue Trane' } })

describe('SongRecording', () => {
  it('names the recording, the album in italics', async () => {
    const w = await mount()
    expect(w.find('h2').text()).toBe('Recording')
    expect(w.text()).toContain('John Coltrane, Blue Train (Blue Note, 1958).')
    expect(w.find('em').text()).toBe('Blue Train')
    expect(w.find('button').exists()).toBe(false)
    expect(w.find('a').exists()).toBe(false)
  })

  it('with a video: a player that loads nothing until pressed, and a link that opens a new tab', async () => {
    const w = await mount('XpZHUVjQydI')
    expect(w.find('button').text()).toContain('Play the video (loads YouTube)')
    expect(w.find('iframe').exists()).toBe(false)
    const a = w.find('a[href="https://www.youtube.com/watch?v=XpZHUVjQydI"]')
    expect(a.text()).toContain('Watch on YouTube')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
    await w.find('button').trigger('click')
    expect(w.find('iframe').attributes('src')).toContain('youtube-nocookie.com/embed/XpZHUVjQydI')
  })

  it('with a video that will not play embedded: only a link that opens a new tab, no player', async () => {
    const w = await mount('XpZHUVjQydI', false)
    expect(w.find('button').exists()).toBe(false)
    const a = w.find('a[href="https://www.youtube.com/watch?v=XpZHUVjQydI"]')
    expect(a.text()).toContain('Listen on YouTube')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
  })
})
