import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { Component } from 'vue'
import { describe, expect, it } from 'vitest'
import { DECISIONS, type DocPage } from '@chord-scale-maker/engine'
import Functions from '~/pages/functions.vue'
import Help from '~/pages/help.vue'
import HowItDecides from '~/pages/how-it-decides.vue'

// every flag on, as e2e builds: a decision may be documented in a section a flag still hides (backup, #466)
mockNuxtImport('useFeature', () => () => true)

/** the pages a decision can live on (the analysis rules' rows: functionsPage.test.ts) */
const PAGES: Record<DocPage, Component> = { help: Help, functions: Functions, 'how-it-decides': HowItDecides }

describe('the decision registry’s anchors', () => {
  it('finds every decision’s anchor, once, on its page', async () => {
    const mounted = new Map<DocPage, Awaited<ReturnType<typeof mountSuspended>>>()
    for (const d of DECISIONS) {
      if (!mounted.has(d.page)) mounted.set(d.page, await mountSuspended(PAGES[d.page]))
      expect(mounted.get(d.page)!.findAll(`[id="${d.anchor}"]`), `${d.id}: #${d.anchor} on /${d.page}`).toHaveLength(1)
    }
  })

  it('has each section on How it decides once, and warns of one the registry doesn’t name', async () => {
    const page = await mountSuspended(HowItDecides)
    const ids = page.findAll('[data-decision]').map((s) => s.attributes('data-decision')!)
    expect(ids.length).toBe(new Set(ids).size)
    const known = new Set<string>(DECISIONS.map((d) => d.id))
    const stale = ids.filter((id) => !known.has(id))
    if (stale.length) console.warn(`How it decides has sections no decision names: ${stale.join(', ')}`)
  })
})
