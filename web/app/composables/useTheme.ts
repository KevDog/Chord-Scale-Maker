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
    writeStored(KEY, next)
  }

  return { theme, toggle: () => setTheme(theme.value === 'dark' ? 'light' : 'dark') }
}
