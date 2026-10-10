import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ambiguities, analyse } from '../analysis'
import { keyCode, parseKey } from '../analysis/keys'
import { parseChart } from '../chart'

const report = (text: string): string[] => ambiguities(analyse(parseChart(text).value))
const C_TUNE = 'title: T\nkey: C\nA | 1 | CMaj7\nA | 2 | D7\nA | 3 | Dm7\nA | 4 | G7\nA | 5 | Am7\nA | 6 | Dm7\nA | 7 | G7\nA | 8 | CMaj7\n'

describe('the ambiguity report', () => {
  it('writes keys as key: and @key take them', () => {
    expect(['D', 'Bb minor', 'F#m'].map((k) => keyCode(parseKey(k) ?? { tonic: 0, minor: false, name: '' }))).toEqual(['D', 'Bbm', 'F#m'])
  })

  it('lists the rows the rules could only guess at, with functions to try', () => {
    expect(report(C_TUNE)).toEqual([
      "bar 2 D7: II7 in C, not resolving: natural tensions; if it's V7/V, V7/v, subV7/♭II, subV7/♭ii or ♭VII7/III, choose that as its function",
    ])
  })

  it('leaves out a row whose function is stated', () => {
    expect(report(C_TUNE.replace('A | 2 | D7', 'A | 2 | D7 | | V7/V'))).toEqual([])
  })

  it('offers an @key for each found key area away from home, and a key: line when there is none', () => {
    const body = report(readFileSync('../charts/body_and_soul.txt', 'utf8'))
    expect(body).toContain('key area D, bars 16–24, found by cadence: pin it with  @key A2 16 D  and  @key B 24 Db')
    expect(report(C_TUNE.replace('key: C\n', ''))[0]).toBe('no key: line; the analysis guessed C: add  key: C')
  })

  it('returns to the next area after a pinned one, so the pin holds only its own bars', () => {
    const text = readFileSync('../charts/a_night_in_tunisia.txt', 'utf8')
    const line = report(text).find((l) => l.startsWith('key area F'))
    expect(line).toBe('key area F, bars 21–24, found by cadence: pin it with  @key B 21 F  and  @key A3 25 Dm')
    const keyAt = (t: string, bar: string): string | undefined => analyse(parseChart(t).value).rows.find((r) => r.bar === bar)?.key.name
    const pinned = `${text}${(line?.match(/@key \S+ \S+ \S+/g) ?? []).join('\n')}\n`
    expect(['21', '25', '44'].map((b) => keyAt(pinned, b))).toEqual(['F major', 'D minor', 'D minor'])
    expect(['25', '44'].map((b) => keyAt(pinned, b))).toEqual(['25', '44'].map((b) => keyAt(text, b)))
  })

  it('pins the last area with one line', () => {
    expect(report(readFileSync('../charts/beatrice.txt', 'utf8'))).toContain('key area D minor, bars 11–16, found by cadence: pin it with  @key A 11 Dm')
  })

  it("asks for a key: line when the analysis can't guess one", () => {
    expect(report('title: T\nA | 1 | Hm7\n')).toEqual(["no key: line, and the analysis couldn't guess one: add  key: …"])
  })

  it("keeps the chord's own numeral when stating it would name a target", () => {
    const misty = report(readFileSync('../charts/misty.txt', 'utf8'))
    expect(misty.find((l) => l.startsWith('bar 23 Bb7:'))).toContain("if it's V7, ")
  })

  it('ends with the problems, by line number', () => {
    expect(report(C_TUNE.replace('A | 2 | D7', 'A | 2 | D7 | | X7')).at(-1)).toBe('line 4: "X7" isn\'t a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)')
  })
})
