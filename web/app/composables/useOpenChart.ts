import { type Diagnostic, decodeIReal, type IRealSong, irealToChart } from '@chord-scale-maker/engine'

/**
 * Open chart…: a chart file becomes a new chart in My charts, then opens in the editor. With iReal import on, an
 * iReal Pro export or link does too: a playlist asks which song, and anything it couldn't map waits for Open anyway.
 */
export function useOpenChart() {
  const ireal = useFeature('ireal')
  const error = ref('')
  const busy = ref(false)
  const songs = ref<readonly IRealSong[]>([])
  const playlist = ref('')
  const report = ref<readonly Diagnostic[]>([])
  let pending = '' // the chart text waiting on Open anyway

  async function save(text: string): Promise<void> {
    const id = newChartId()
    if (!saveChart({ id, text, kind: 'new' }).ok) {
      error.value = "Couldn't open it: this browser's storage is full, or My charts is at its limit."
      return
    }
    await navigateTo({ path: '/song', query: { mine: id } })
  }

  async function choose(index: number): Promise<void> {
    const song = songs.value[index]
    if (!song) return
    songs.value = []
    const chart = irealToChart(song)
    if (chart.diagnostics.length) {
      pending = chart.value
      report.value = chart.diagnostics
      return
    }
    await save(chart.value)
  }

  async function openIReal(text: string): Promise<void> {
    error.value = ''
    const { value, diagnostics } = decodeIReal(text)
    if (!value.songs.length) {
      error.value = `Couldn't read that iReal Pro link: ${diagnostics[0]?.message ?? 'no songs in it'}.`
      return
    }
    playlist.value = value.name ?? ''
    songs.value = value.songs
    if (value.songs.length === 1) await choose(0)
  }

  async function confirm(): Promise<void> {
    const text = pending
    cancel()
    if (text) await save(text)
  }

  function cancel(): void {
    pending = ''
    error.value = ''
    report.value = []
    songs.value = []
  }

  async function open(file: File | undefined): Promise<void> {
    if (!file || busy.value) return
    busy.value = true
    error.value = ''
    try {
      const read = await readChartFile(file, { ireal })
      if (!read.ok) {
        error.value = read.error
        return
      }
      if (read.kind === 'ireal') await openIReal(read.text)
      else await save(read.text)
    } finally {
      busy.value = false
    }
  }

  return { open, openIReal, choose, confirm, cancel, error: readonly(error), busy: readonly(busy), songs: readonly(songs), playlist: readonly(playlist), report: readonly(report) }
}
