import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect } from '../fixtures'

/** a known violation the scans let through: the axe rule, the elements (by selector or axe's message), why, and the issue that fixes it */
type Exception = Readonly<{ rule: string; target?: RegExp; message?: RegExp; reason: string; issue: number }>

export const EXCEPTIONS: readonly Exception[] = []

const BLOCKING = new Set(['serious', 'critical'])

/**
 * an axe scan of the page as it is now (WCAG 2.2 A and AA, and best practice): no serious or critical violation
 * unless an exception allows it. include: scan only these elements (an open popover, whose panel covers the triggers
 * below it, which axe would read as too small)
 */
export async function expectAccessible(page: Page, include?: string): Promise<void> {
  // a popover still fading in or out reads as low contrast
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const builder = new AxeBuilder({ page })
  if (include) builder.include(include)
  const { violations } = await builder
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  const found = violations
    .filter((v) => BLOCKING.has(v.impact ?? ''))
    .flatMap((v) =>
      v.nodes
        .map((n) => ({ target: n.target.join(' '), message: n.any[0]?.message ?? '' }))
        .filter(({ target, message }) => !EXCEPTIONS.some((e) => e.rule === v.id && (e.target?.test(target) ?? true) && (e.message?.test(message) ?? true)))
        .map(({ target, message }) => `${v.impact} ${v.id}: ${target} (${v.help}) ${message}`),
    )
  expect(found).toEqual([])
}
