/** whether a CSS media query matches, kept up to date (client-only; `initial` until mounted) */
export function useMediaQuery(query: string, initial = true) {
  const matches = ref(initial)
  let list: MediaQueryList | undefined
  const update = (): void => {
    matches.value = list?.matches ?? initial
  }
  onMounted(() => {
    list = window.matchMedia(query)
    update()
    list.addEventListener('change', update)
  })
  onBeforeUnmount(() => list?.removeEventListener('change', update))
  return readonly(matches)
}
