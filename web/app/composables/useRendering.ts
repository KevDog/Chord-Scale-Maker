import { readonly, ref } from 'vue'

/**
 * A shared counter of in-flight sheet (re)renders, so the preview can show one spinner while VexFlow loads and draws.
 * `busy` trails `active > 0` by ~150 ms, so a quick redraw doesn't flash the spinner.
 */
const active = ref(0)
const busy = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

function sync(): void {
  if (active.value > 0) {
    if (!busy.value && !timer) timer = setTimeout(() => ((busy.value = true), (timer = undefined)), 150)
  } else {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    busy.value = false
  }
}

export function useRendering() {
  /** mark a render started; call the returned function once when it finishes (further calls are no-ops) */
  const begin = (): (() => void) => {
    active.value++
    sync()
    let done = false
    return () => {
      if (done) return
      done = true
      active.value = Math.max(0, active.value - 1)
      sync()
    }
  }
  return { active: readonly(active), busy: readonly(busy), begin }
}
