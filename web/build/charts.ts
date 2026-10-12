import { readFileSync } from 'node:fs'
import { sep } from 'node:path'
import type { Plugin } from 'vite'
import { publishedChart } from '../app/utils/published'

/** the library's `?raw` chart imports, loaded without their internal-only lines, so the bundle never carries them */
export function chartsPlugin(chartsDir: string): Plugin {
  const dir = chartsDir.endsWith(sep) ? chartsDir : chartsDir + sep
  return {
    name: 'published-charts',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?')
      if (!file?.startsWith(dir) || !file.endsWith('.txt') || !query?.split('&').includes('raw')) return undefined
      return `export default ${JSON.stringify(publishedChart(readFileSync(file, 'utf8')))}`
    },
  }
}
