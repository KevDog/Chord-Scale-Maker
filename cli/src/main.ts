import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { add, type Effects } from './add'
import { parseAddArgs, USAGE } from './args'

/** csm <verb> …: the exit code (2: usage) */
export function main(argv: readonly string[], fx: Effects): number {
  const [verb, ...rest] = argv
  if (verb !== 'add') {
    fx.err(USAGE)
    return 2
  }
  const args = parseAddArgs(rest)
  if (typeof args === 'string') {
    fx.err(args)
    return 2
  }
  return add(args, fx)
}

const ENGINE = dirname(createRequire(import.meta.url).resolve('@chord-scale-maker/engine/package.json'))
const REPO = resolve(ENGINE, '..')

/** the repo's files, its make targets and the terminal */
export const realEffects = (): Effects => ({
  read: (p) => readFileSync(resolve(process.cwd(), p), 'utf8'),
  exists: existsSync,
  write: (p, t) => writeFileSync(p, t),
  run: (target) => spawnSync('make', [target], { cwd: REPO, stdio: 'inherit' }).status ?? 1,
  out: (l) => console.log(l),
  err: (l) => console.error(l),
  chartsDir: `${ENGINE}/charts/`,
  date: new Date().toISOString().slice(0, 10),
})

// bin/csm.mjs sets CSM_MAIN; the tests import main alone
if (process.env.CSM_MAIN === '1') process.exit(main(process.argv.slice(2), realEffects()))
