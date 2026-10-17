// The URLs a production deploy changed (build/indexnow.ts), for IndexNow (Bing and others recrawl them):
//   npm run indexnow -- --from <previous deploy's sha> --to <this one's>   prints them
//   … --ping                                                              sends them to api.indexnow.org
// No --from (the first deploy), or one git doesn't know: every sitemap URL. A failed ping only warns (exit 0): the
// deploy is already live, and search engines find the pages through the sitemap anyway.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { indexNowLibrary, urlsFor } from '../build/indexnow'
import { libraryCharts } from '../build/ogCard'
import { SITE_URL } from '../app/utils/site'

const PUBLIC = new URL('../public/', import.meta.url).pathname
const REPO = new URL('../../', import.meta.url).pathname

const arg = (name: string): string => {
  const i = process.argv.indexOf(name)
  return i < 0 ? '' : (process.argv[i + 1] ?? '')
}

function changedPaths(from: string, to: string): string[] | null {
  if (!from) return null
  try {
    return execFileSync('git', ['-C', REPO, 'diff', '--name-only', `${from}..${to || 'HEAD'}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean)
  } catch {
    console.log(`git can't compare ${from}..${to}: sending every sitemap URL`)
    return null
  }
}

/** the key file in public/ (<key>.txt, the key itself), which tells IndexNow the pings are ours */
function key(): string {
  const file = readdirSync(PUBLIC).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
  if (!file) throw new Error('no IndexNow key file (public/<32 hex>.txt)')
  return readFileSync(PUBLIC + file, 'utf8').trim()
}

async function ping(urlList: readonly string[]): Promise<void> {
  const k = key()
  const body = { host: new URL(SITE_URL).host, key: k, keyLocation: `${SITE_URL}/${k}.txt`, urlList }
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (res.ok) console.log(`IndexNow: ${res.status} for ${urlList.length} URLs`)
    else console.log(`::warning::IndexNow: ${res.status} ${res.statusText} ${text}`.trim())
  } catch (e) {
    console.log(`::warning::IndexNow: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const urls = urlsFor(changedPaths(arg('--from'), arg('--to')), indexNowLibrary(libraryCharts()))
if (process.argv.includes('--ping')) await ping(urls)
else console.log(urls.join('\n'))
