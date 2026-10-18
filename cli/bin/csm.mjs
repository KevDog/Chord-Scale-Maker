#!/usr/bin/env node
// csm: runs src/main.ts through vite-node (the engine is TypeScript with extensionless imports)
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const viteNode = join(dirname(require.resolve('vite-node/package.json')), 'dist/cli.mjs')
const main = join(dirname(fileURLToPath(import.meta.url)), '../src/main.ts')
const { status } = spawnSync(process.execPath, [viteNode, main, '--', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, CSM_MAIN: '1' } })
process.exit(status ?? 1)
