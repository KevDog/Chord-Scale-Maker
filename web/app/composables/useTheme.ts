export type Theme = 'light' | 'dark'

const KEY = 'csm-theme' // also read by public/theme-init.js

/** light/dark toggle, persisted per browser; default light */
export function useTheme() {
  const theme = useState<Theme>('theme', () => 'light')

  onMounted(() => {
    theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  function setTheme(next: Theme): void {
    theme.value = next
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // storage unavailable (private mode): the toggle still works for this visit
    }
  }

  return { theme, toggle: () => setTheme(theme.value === 'dark' ? 'light' : 'dark') }
}
