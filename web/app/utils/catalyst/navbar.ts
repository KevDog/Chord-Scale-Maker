// Catalyst NavbarItem styles, from catalyst-ui-kit/typescript/navbar.tsx (Tailwind Plus license): shared by UiNavbarItem and UiNavbarDropdown's button
export const navbarItemClasses = [
  // Base
  'relative flex min-w-0 items-center gap-3 rounded-lg p-2 text-left text-base/6 font-medium text-zinc-950 sm:text-sm/5',
  // Leading icon/icon-only
  '*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-500 sm:*:data-[slot=icon]:size-5',
  // Trailing icon (down chevron or similar)
  '*:not-nth-2:last:data-[slot=icon]:ml-auto *:not-nth-2:last:data-[slot=icon]:size-5 sm:*:not-nth-2:last:data-[slot=icon]:size-4',
  // Hover
  'data-hover:bg-zinc-950/5 data-hover:*:data-[slot=icon]:fill-zinc-950',
  // Active
  'data-active:bg-zinc-950/5 data-active:*:data-[slot=icon]:fill-zinc-950',
  // Dark mode
  'dark:text-white dark:*:data-[slot=icon]:fill-zinc-400',
  'dark:data-hover:bg-white/5 dark:data-hover:*:data-[slot=icon]:fill-white',
  'dark:data-active:bg-white/5 dark:data-active:*:data-[slot=icon]:fill-white',
]
