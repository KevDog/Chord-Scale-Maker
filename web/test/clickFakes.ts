import type { ClickAudio } from '~/utils/clickSounds'

/** a click's audio with a clock the test sets, recording what it is asked to play */
export type FakeAudio = ClickAudio & { clock: { t: number }; played: { kind: string; time: number }[]; notes: { midi: number; time: number; length: number }[] }

export function fakeAudio(): FakeAudio {
  const clock = { t: 0 }
  const played: { kind: string; time: number }[] = []
  const notes: { midi: number; time: number; length: number }[] = []
  return {
    clock,
    played,
    notes,
    now: () => clock.t,
    play: (kind, time) => played.push({ kind, time }),
    note: (midi, time, length) => notes.push({ midi, time, length }),
    resume: async () => {},
    suspend: async () => {},
    close: async () => {},
  }
}

/** the scheduler's interval, run by hand with tick() */
export function timers() {
  let tick: (() => void) | null = null
  return {
    setInterval: (fn: () => void): number => {
      tick = fn
      return 1
    },
    clearInterval: (): void => {
      tick = null
    },
    raf: (): number => 0,
    tick: (): void => tick?.(),
  }
}
