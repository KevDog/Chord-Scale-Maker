/** the page doesn't scroll behind focus mode (but prints in full) */
const LOCK = ['overflow-hidden', 'print:overflow-visible']

/**
 * focus mode: the sheet alone, over the whole page. Escape or exit() leaves it, and focus goes back to
 * whatever opened it.
 */
export function useFocusMode() {
  const on = ref(false)
  let opener: HTMLElement | null = null

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !e.defaultPrevented) exit()
  }
  const lock = (locked: boolean): void => {
    for (const c of LOCK) document.documentElement.classList.toggle(c, locked)
  }

  function enter(): void {
    if (on.value) return
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    on.value = true
    lock(true)
    window.addEventListener('keydown', onKey)
  }

  function exit(): void {
    if (!on.value) return
    on.value = false
    lock(false)
    window.removeEventListener('keydown', onKey)
    const back = opener
    opener = null
    nextTick(() => back?.focus())
  }

  onBeforeUnmount(() => {
    if (!on.value) return
    lock(false)
    window.removeEventListener('keydown', onKey)
  })

  return { on: readonly(on), enter, exit }
}
