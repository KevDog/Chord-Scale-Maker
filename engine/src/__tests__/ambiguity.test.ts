import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ambiguities, analyse } from '../analysis'
import { keyCode, parseKey } from '../analysis/keys'
import { expandRowLines, parseChart } from '../chart'

const report = (text: string): string[] => ambiguities(analyse(parseChart(text).value))
const C_TUNE = 'title: T\nkey: C\n\nsection: A\n1 | CMaj7\n2 | D7\n3 | Dm7\n4 | G7\n5 | Am7\n6 | Dm7\n7 | G7\n8 | CMaj7\n'

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
    expect(report(C_TUNE.replace('2 | D7', '2 | D7 | | V7/V'))).toEqual([])
  })

  it('offers a pin for each found key area away from home, in each section it runs through, and a key: line when there is none', () => {
    const body = report(readFileSync('charts/body-and-soul.txt', 'utf8'))
    expect(body).toContain('key area D, A2 8 – B 8, found by cadence: pin it with  in section A2: @key 8 D  and  in section B: key: D  and  in section B: @key 8 Db')
    expect(report(C_TUNE.replace('key: C\n', ''))[0]).toBe('no key: line; the analysis guessed C: add  key: C')
  })

  it('needs no pin back when the area ends with its section: a stated key holds only to the section’s end', () => {
    const text = readFileSync('charts/a-night-in-tunisia.txt', 'utf8')
    const line = report(text).find((l) => l.startsWith('key area F'))
    expect(line).toBe('key area F, B 5–8, found by cadence: pin it with  in section B: @key 5 F')
    const keyAt = (t: string, section: string, bar: string): string | undefined => {
      const doc = parseChart(t).value
      const rows = expandRowLines(doc).value
      return analyse(doc).rows.find((r) => r.bar === bar && rows[r.row]?.section === section)?.key.name
    }
    const pinned = text.replace(/(\nsection: B\n(?:.*\n)*?)(5 +\|)/, '$1@key 5 F\n$2')
    expect([keyAt(pinned, 'B', '5'), keyAt(pinned, 'A3', '1')]).toEqual(['F major', 'D minor'])
    expect(keyAt(pinned, 'A3', '1')).toBe(keyAt(text, 'A3', '1'))
  })

  it('pins the last area with one line', () => {
    expect(report(readFileSync('charts/beatrice.txt', 'utf8'))).toContain('key area D minor, A 11–16, found by cadence: pin it with  in section A: @key 11 Dm')
  })

  it("asks for a key: line when the analysis can't guess one", () => {
    expect(report('title: T\n\nsection: A\nbars: 4\n1 | Hm7\n')).toEqual(["no key: line, and the analysis couldn't guess one: add  key: …"])
  })

  it("keeps the chord's own numeral when stating it would name a target", () => {
    // the end of Misty's bridge, before its bar 23 stated V7: Bb7 goes on through Edim7, so the rules can only guess
    const bridge = 'title: T\nkey: Eb\n\nsection: A\nbars: 8\n1 | Am7\n2 | D7\n2 | F7\n3 | Bb7\n3 | Edim7\n4 | Fm7\n4 | Bb7\n5 | EbMaj7\n'
    expect(report(bridge).find((l) => l.startsWith('bar 3 Bb7:'))).toContain("if it's V7, ")
  })

  it('ends with the problems, by line number', () => {
    expect(report(C_TUNE.replace('2 | D7', '2 | D7 | | X7')).at(-1)).toBe('line 6: "X7" isn\'t a function (V7/ii, subV7, ii7/V, ♭VII7, IVmaj7)')
  })
})
