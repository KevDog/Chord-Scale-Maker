import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { fitError, functionCandidates, functionRoot, impliedTarget, parseFunction, sameFunction, type StatedFunction } from '../analysis/functions'
import { type Key, parseKey } from '../analysis/keys'
import { familyOf } from '../analysis/stream'
import { parseChart } from '../chart'
import { pcOf, rootName } from '../pitch'
import { readChord } from '../qualities'
import { isSyncCopy } from '../util'

const fn = (text: string): StatedFunction => {
  const f = parseFunction(text)
  if (typeof f === 'string') throw new Error(f)
  return f
}
const key = (text: string): Key => {
  const k = parseKey(text)
  if (!k) throw new Error(text)
  return k
}
const LIBRARY = new URL('../../../charts/', import.meta.url)
const libraryRows = () =>
  readdirSync(LIBRARY)
    .filter((x) => x.endsWith('.txt') && !isSyncCopy(x))
    .flatMap((f) => analyse(parseChart(readFileSync(new URL(f, LIBRARY), 'utf8')).value).rows.map((r) => ({ f, r })))

describe('parseFunction', () => {
  it("reads the Changes sheet's numerals and their ASCII spellings into one form", () => {
    const cases: [string, string][] = [
      ['V7/ii', 'V7/ii'],
      ['subV7/IV', 'subV7/IV'],
      ['ii7/V', 'ii7/V'],
      ['iim7b5/vi', 'iiø7/vi'],
      ['bVII7', '♭VII7'],
      ['viio7/ii', 'vii°7/ii'],
      ['IVMaj7', 'IVmaj7'],
      ['IΔ7', 'Imaj7'],
      ['I6', 'I6'],
      ['V7sus4', 'V7sus'],
      ['#ivø', '♯ivø7'],
      ['i(maj7)', 'i(maj7)'],
      ['♭VI7', '♭VI7'],
    ]
    for (const [input, text] of cases) expect(fn(input).text, input).toBe(text)
  })

  it('reads the family from the case and the quality', () => {
    expect(['V7', 'ii7', 'iiø7', 'vii°7', 'IVmaj7', 'vi', 'V7sus', 'I'].map((t) => fn(t).family)).toEqual([
      'dominant', 'minor', 'halfdim', 'dim', 'major', 'minor', 'sus', 'major',
    ])
  })

  it('reads a key before a colon, and keeps it out of the text', () => {
    expect([fn('D: V7/ii').key?.name, fn('D: V7/ii').text]).toEqual(['D major', 'V7/ii'])
    expect(fn('Bbm: iiø7').key?.name).toBe('Bb minor')
    expect(fn('V7').key).toBeNull()
  })

  it('says what is wrong with a function it cannot read', () => {
    expect(parseFunction('X7')).toBe('"X7" isn\'t a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)')
    expect(parseFunction('subii7')).toBe('sub only goes on a dominant (subV7)')
    expect(parseFunction('ivmaj7')).toBe('ivmaj7: a major quality on a lower-case numeral')
    expect(parseFunction('H: V7')).toBe('"H" isn\'t a key (Eb, Cm)')
  })

  it('knows two spellings of one function', () => {
    expect(sameFunction('bVII7/III', '♭VII7/III')).toBe(true)
    expect(sameFunction('D: V7/ii', 'D:V7/ii')).toBe(true)
    expect(sameFunction('V7/ii', 'D: V7/ii')).toBe(false)
    expect(sameFunction('X7', 'X7')).toBe(false) // not a function at all
  })
})

describe('where a function puts its chord', () => {
  it('names the root', () => {
    expect(rootName(functionRoot(fn('V7/V'), key('Eb')))).toBe('F')
    expect(rootName(functionRoot(fn('subV7/IV'), key('C')))).toBe('Gb')
    expect(rootName(functionRoot(fn('ii7/V'), key('C')))).toBe('A')
    expect(rootName(functionRoot(fn('♭VII7'), key('C')))).toBe('Bb')
    expect(rootName(functionRoot(fn('vii°7/ii'), key('C')))).toBe('C#')
    expect(rootName(functionRoot(fn('V7'), key('Db')))).toBe('Ab')
  })

  it('implies the tonic for V7, subV7, ♭VII7, ii and vii°7 without a target', () => {
    expect(impliedTarget(fn('V7'), key('Cm'))).toEqual({ steps: 0, semis: 0, minor: true })
    expect(impliedTarget(fn('subV7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: false })
    expect(impliedTarget(fn('♭VII7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: false })
    expect(impliedTarget(fn('ii7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: false })
    expect(impliedTarget(fn('iiø7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: true })
    expect(impliedTarget(fn('vii°7'), key('C'))).toEqual({ steps: 0, semis: 0, minor: false })
    expect(impliedTarget(fn('V7/ii'), key('C'))).toEqual({ steps: 1, semis: 2, minor: true })
    expect(impliedTarget(fn('III7'), key('C'))).toBeNull()
  })

  it("says when a function doesn't fit its chord", () => {
    expect(fitError(fn('V7/V'), { chord: 'D7', pc: 2, family: 'dominant' }, key('C'))).toBeNull()
    expect(fitError(fn('V7/V'), { chord: 'D7sus4', pc: 2, family: 'sus' }, key('C'))).toBeNull()
    expect(fitError(fn('V7/V'), { chord: 'Bb7', pc: 10, family: 'dominant' }, key('C'))).toBe('V7/V in C is on D, not Bb7')
    expect(fitError(fn('ii7'), { chord: 'G7', pc: 7, family: 'dominant' }, key('C'))).toBe('ii7 is a minor chord, G7 a dominant one')
    expect(fitError(fn('ii7'), { chord: 'Hm7', pc: -1, family: null }, key('C'))).toBe("Hm7 can't be read, so its function can't be checked")
  })
})

describe('functionCandidates', () => {
  it("lists what a chord can do in its key, ending with its own degree", () => {
    expect(functionCandidates({ pc: 2, family: 'dominant', quality: '7' }, key('C'))).toEqual(['V7/V', 'V7/v', 'subV7/♭II', 'subV7/♭ii', '♭VII7/III', 'II7'])
    expect(functionCandidates({ pc: 7, family: 'dominant', quality: '7' }, key('C'))).toEqual(['V7', 'V7/i', 'subV7/♯IV', 'subV7/♯iv', '♭VII7/VI', 'V7'].filter((x, i, a) => a.indexOf(x) === i))
    expect(functionCandidates({ pc: 9, family: 'minor', quality: 'm7' }, key('C'))).toEqual(['ii7/V', 'vi7'])
    expect(functionCandidates({ pc: 11, family: 'dim', quality: 'dim7' }, key('C'))).toEqual(['vii°7', 'vii°7/i'])
    expect(functionCandidates({ pc: 5, family: 'major', quality: 'Maj7' }, key('C'))).toEqual(['IVmaj7'])
    expect(functionCandidates({ pc: -1, family: null, quality: '' }, key('C'))).toEqual([])
  })

  it('offers only functions that read and fit, for every chord in the library', () => {
    for (const { f, r } of libraryRows()) {
      const c = readChord(r.chord)
      if (!c) continue
      const chord = { chord: r.chord, pc: pcOf(c.root), family: familyOf(c.quality), quality: c.quality }
      for (const text of functionCandidates(chord, r.key)) {
        const parsed = parseFunction(text)
        expect(typeof parsed === 'string' ? parsed : fitError(parsed, chord, r.key), `${f} bar ${r.bar} ${r.chord}: ${text}`).toBeNull()
      }
    }
  })
})

describe('the round trip with the Changes sheet', () => {
  it('reads back every numeral the analyser gives the library, in the same spelling', () => {
    for (const { f, r } of libraryRows()) {
      if (r.numeral === '?') continue
      const back = parseFunction(r.numeral)
      expect(typeof back === 'string' ? back : back.text, `${f} bar ${r.bar} ${r.chord}`).toBe(r.numeral)
    }
  })
})
