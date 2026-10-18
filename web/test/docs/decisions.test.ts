import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Component } from 'vue'
import { describe, expect, it } from 'vitest'
import { DECISIONS, type DocPage } from '@chord-scale-maker/engine'
import Functions from '~/pages/functions.vue'
import Help from '~/pages/help.vue'

/** the pages a decision can live on; How it decides is built in Phase 2 (the analysis rules' rows: functionsPage.test.ts) */
const PAGES: Record<DocPage, Component | null> = { help: Help, functions: Functions, 'how-it-decides': null }

describe('the decision registry’s anchors', () => {
  it('finds every decision’s anchor, once, on its page', async () => {
    const mounted = new Map<DocPage, Awaited<ReturnType<typeof mountSuspended>>>()
    for (const d of DECISIONS) {
      const page = PAGES[d.page]
      expect(page, `${d.id}: no page ${d.page}`).not.toBeNull()
      if (!mounted.has(d.page)) mounted.set(d.page, await mountSuspended(page!))
      expect(mounted.get(d.page)!.findAll(`[id="${d.anchor}"]`), `${d.id}: #${d.anchor} on /${d.page}`).toHaveLength(1)
    }
  })
})
