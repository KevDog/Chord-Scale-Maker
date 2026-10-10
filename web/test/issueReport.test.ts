import { describe, expect, it } from 'vitest'
import { issuePart, issueText, issueTitle, issueUrl, URL_LIMIT } from '~/utils/issueReport'

const F = { title: 'Autumn Leaves', chord: 'Am7b5', numeral: 'iiø7', heardIn: 'G minor', scale: 'A Locrian', rule: 'h2', reason: 'iiø7 of the ii–V to G minor: the b9 is in the key', link: 'https://www.chordscalemaker.com/song#s=abc' }

describe('issue report', () => {
  it('the text names the chord, its function, key area, scale, rule and the link, and asks what was expected', () => {
    expect(issueText(F)).toBe(
      [
        'Chart: Autumn Leaves',
        'Chord: Am7b5',
        'Function: iiø7',
        'Key area: G minor',
        'Scale shown: A Locrian',
        'Rule: h2 (iiø7 of the ii–V to G minor: the b9 is in the key)',
        'Expected: (the scale you expected, and why: a melody note, a recording, a book)',
        'Link: https://www.chordscalemaker.com/song#s=abc',
      ].join('\n'),
    )
  })

  it('the title names the chart, the chord and the rule', () => {
    expect(issueTitle(F)).toBe('Autumn Leaves: Am7b5 (iiø7), rule h2')
  })

  it('on a transposing part, names the instrument and says which lines are written for it and which are concert', () => {
    const T = { title: 'T', chord: 'A7', concert: 'G7', part: { name: 'B♭ Trumpet', transposes: true }, numeral: 'V7', heardIn: 'D major', scale: 'A Mixolydian', rule: 'D4', reason: 'V7 of C: natural tensions', link: 'https://x/song#s=1' }
    expect(issueText(T)).toBe(
      [
        'Chart: T',
        'Instrument: B♭ Trumpet',
        'Chord: A7 (concert G7)',
        'Function: V7',
        'Key area (written for B♭ Trumpet): D major',
        'Scale shown (written for B♭ Trumpet): A Mixolydian',
        'Rule: D4 (V7 of C: natural tensions), in concert pitch',
        'Expected: (the scale you expected, and why: a melody note, a recording, a book)',
        'Link: https://x/song#s=1',
      ].join('\n'),
    )
    expect(issueTitle(T)).toBe('T: G7 (V7), rule D4')
  })

  it('a concert-pitch part reads as before: no instrument, no labels', () => {
    expect(issueText({ ...F, concert: 'Am7b5', part: { name: 'Trombone', transposes: false } })).toBe(issueText(F))
  })

  it('a chord the sheet respells names the chart\'s spelling too', () => {
    expect(issueText({ ...F, chord: 'Db7', concert: 'C#7' })).toContain('Chord: Db7 (concert C#7)')
  })

  it('names a part by its key and its name as the Instrument menu has it', () => {
    expect(issuePart('trumpet')).toEqual({ name: 'B♭ Trumpet', transposes: true })
    expect(issuePart('alto-sax')).toEqual({ name: 'E♭ Alto Sax', transposes: true })
    expect(issuePart('horn')).toEqual({ name: 'F Horn', transposes: true })
    expect(issuePart('trombone')).toEqual({ name: 'Trombone', transposes: false })
    expect(issuePart('concert')).toEqual({ name: 'Concert', transposes: false })
  })

  it('the GitHub link carries the title and the text while it fits', () => {
    const { url, full } = issueUrl('T', 'body')
    expect(full).toBe(true)
    expect(url).toBe('https://github.com/KevDog/Chord-Scale-Maker/issues/new?title=T&body=body')
  })

  it('a body too long for the URL leaves the link with the title only', () => {
    const { url, full } = issueUrl('T', 'x'.repeat(URL_LIMIT))
    expect(full).toBe(false)
    expect(url).toBe('https://github.com/KevDog/Chord-Scale-Maker/issues/new?title=T')
  })

  it('the limit is on the whole URL', () => {
    const base = 'https://github.com/KevDog/Chord-Scale-Maker/issues/new?title=T&body='.length
    expect(issueUrl('T', 'x'.repeat(URL_LIMIT - base)).full).toBe(true)
    expect(issueUrl('T', 'x'.repeat(URL_LIMIT - base + 1)).full).toBe(false)
  })
})
