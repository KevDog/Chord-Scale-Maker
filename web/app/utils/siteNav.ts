import type { Component } from 'vue'
import { BookOpenIcon, EnvelopeIcon, InformationCircleIcon, LightBulbIcon, MusicalNoteIcon, QuestionMarkCircleIcon, VariableIcon } from '@heroicons/vue/20/solid'

/** a page in the navbar (icon: the phone menu's) */
export type NavLink = Readonly<{ label: string; href: string; icon: Component }>
/** a navbar dropdown of pages (the phone menu lists them flat) */
export type NavMenu = Readonly<{ label: string; items: readonly NavLink[] }>
export type NavEntry = NavLink | NavMenu

/** the navbar, left to right: the reference pages as links (Chords joins Scales with #498), the rest in the Help menu */
export const NAV: readonly NavEntry[] = [
  { label: 'Library', href: '/library', icon: BookOpenIcon },
  { label: 'Scales', href: '/scales', icon: MusicalNoteIcon },
  {
    label: 'Help',
    items: [
      { label: 'How it works', href: '/help', icon: QuestionMarkCircleIcon },
      { label: 'How it decides', href: '/how-it-decides', icon: LightBulbIcon },
      { label: 'Functions', href: '/functions', icon: VariableIcon },
      { label: 'About', href: '/about', icon: InformationCircleIcon },
      { label: 'Contact', href: '/contact', icon: EnvelopeIcon },
    ],
  },
]

export const isMenu = (e: NavEntry): e is NavMenu => 'items' in e

/** every page in the navbar, in order: the phone menu */
export const navLinks = (nav: readonly NavEntry[]): readonly NavLink[] => nav.flatMap((e) => (isMenu(e) ? e.items : [e]))

/** a link is current on its page and the pages under it (/scales/dorian); a menu, when one of its items is */
export function isCurrent(e: NavEntry, path: string): boolean {
  if (isMenu(e)) return e.items.some((i) => isCurrent(i, path))
  return path === e.href || path.startsWith(`${e.href}/`)
}
