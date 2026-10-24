import type { ClickAudio } from '~/utils/clickSounds'

/** a booked note: stopped, once its stop is called */
export type FakeNote = { midi: number; time: number; length: number; stopped: boolean }
/** a click's audio with a clock the test sets, recording what it is asked to play */
export type FakeAudio = ClickAudio & { clock: { t: number }; played: { kind: string; time: number }[]; notes: FakeNote[]; hits: { time: number; accent: boolean }[]; suspended: { n: number }; leadLoads: { n: number }; harmonyLoads: { n: number }; comps: FakeNote[]; basses: FakeNote[] }

export function fakeAudio(): FakeAudio {
  const clock = { t: 0 }
  const played: { kind: string; time: number }[] = []
  const notes: FakeNote[] = []
  const hits: { time: number; accent: boolean }[] = []
  const suspended = { n: 0 }
  const leadLoads = { n: 0 }
  const harmonyLoads = { n: 0 }
  const comps: FakeNote[] = []
  const basses: FakeNote[] = []
  const book = (into: FakeNote[]) => (midi: number, time: number, length: number) => {
    const n = { midi, time, length, stopped: false }
    into.push(n)
    return () => (n.stopped = true)
  }
  return {
    clock,
    played,
    notes,
    hits,
    suspended,
    leadLoads,
    harmonyLoads,
    comps,
    basses,
    now: () => clock.t,
    play: (kind, time) => played.push({ kind, time }),
    note: (midi, time, length) => {
      const n = { midi, time, length, stopped: false }
      notes.push(n)
      return () => (n.stopped = true)
    },
    hit: (time, accent) => hits.push({ time, accent }),
    loadLead: async () => {
      leadLoads.n += 1
      return true
    },
    comp: book(comps),
    bass: book(basses),
    loadHarmony: async () => {
      harmonyLoads.n += 1
      return true
    },
    resume: async () => {},
    suspend: async () => {
      suspended.n += 1
    },
    close: async () => {},
  }
}

/** the scheduler's interval and the phrase's end, run by hand with tick() and end() */
export function timers() {
  let tick: (() => void) | null = null
  let ending: (() => void) | null = null
  return {
    setInterval: (fn: () => void): number => {
      tick = fn
      return 1
    },
    clearInterval: (): void => {
      tick = null
    },
    setTimeout: (fn: () => void): number => {
      ending = fn
      return 2
    },
    clearTimeout: (): void => {
      ending = null
    },
    raf: (): number => 0,
    tick: (): void => tick?.(),
    end: (): void => ending?.(),
  }
}
