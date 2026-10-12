import { currentSection } from '~/utils/currentSection'

/** the address's #id, decoded (as written, if it won't decode) */
function hashId(): string {
  const raw = location.hash.slice(1)
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** the id of the section being read, kept up to date as the page scrolls (client-only; '' until mounted) */
export function useCurrentSection(ids: () => readonly string[], line = 120) {
  const current = ref('')
  let frame = 0
  const update = (): void => {
    frame = 0
    const tops = ids().flatMap((id) => {
      const el = document.getElementById(id)
      return el ? [{ id, top: el.getBoundingClientRect().top }] : []
    })
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    current.value = currentSection(tops, line, atEnd ? { height: window.innerHeight, hash: hashId() } : undefined)
  }
  const onScroll = (): void => {
    if (!frame) frame = requestAnimationFrame(update)
  }
  onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    window.addEventListener('hashchange', onScroll)
    update()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
    window.removeEventListener('hashchange', onScroll)
    if (frame) cancelAnimationFrame(frame)
  })
  return readonly(current)
}
