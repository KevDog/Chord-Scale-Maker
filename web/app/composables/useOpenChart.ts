/** Open chart…: a chart file becomes a new chart in My charts, then opens in the editor */
export function useOpenChart() {
  const error = ref('')
  const busy = ref(false)

  async function open(file: File | undefined): Promise<void> {
    if (!file || busy.value) return
    busy.value = true
    error.value = ''
    try {
      const read = await readChartFile(file)
      if (!read.ok) {
        error.value = read.error
        return
      }
      const id = newChartId()
      const saved = saveChart({ id, text: read.text, kind: 'new' })
      if (!saved.ok) {
        error.value = "Couldn't open it: this browser's storage is full, or My charts is at its limit."
        return
      }
      await navigateTo({ path: '/song', query: { mine: id } })
    } finally {
      busy.value = false
    }
  }

  return { open, error: readonly(error), busy: readonly(busy) }
}
