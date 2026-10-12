import { afterEach, describe, expect, it } from 'vitest'

describe('usePractice', () => {
  afterEach(() => localStorage.clear())

  it('remembers a selection per chart and per mode', () => {
    const a = usePractice('autumn-leaves')
    a.setSelection('root', { preset: 'guideTones' })
    a.setSelection('from', { keys: ['b3', '3'] })
    const again = usePractice('autumn-leaves')
    expect(again.selection('root')).toEqual({ preset: 'guideTones' })
    expect(again.selection('from')).toEqual({ keys: ['b3', '3'] })
    expect(usePractice('so-what').selection('root')).toBeNull()
  })

  it('forgets a cleared selection, and keeps a draft for the visit only', () => {
    const a = usePractice('f-blues')
    a.setSelection('root', { keys: ['3'] })
    a.setSelection('root', null)
    expect(localStorage.getItem('csm-practice:f-blues:root')).toBeNull()
    const draft = usePractice()
    draft.setSelection('root', { keys: ['1'] })
    expect(draft.selection('root')).toEqual({ keys: ['1'] })
    expect(localStorage.length).toBe(0)
  })

  it('ignores stored values that are not selections', () => {
    localStorage.setItem('csm-practice:x:root', '{"preset":"everything"}')
    localStorage.setItem('csm-practice:x:from', '{"keys":["b3","<script>",7,"#4"]}')
    const p = usePractice('x')
    expect(p.selection('root')).toBeNull()
    expect(p.selection('from')).toEqual({ keys: ['b3', '#4'] })
    localStorage.setItem('csm-practice:y:root', 'not json')
    expect(usePractice('y').selection('root')).toBeNull()
  })
})
