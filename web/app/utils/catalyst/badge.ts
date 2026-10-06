// Catalyst badge colours, copied verbatim (only the colours this app uses) from catalyst-ui-kit/typescript/badge.tsx (Tailwind Plus licence)
export const badgeColors = {
  red: 'bg-red-500/15 text-red-700 group-data-hover:bg-red-500/25 dark:bg-red-500/10 dark:text-red-400 dark:group-data-hover:bg-red-500/20',
  amber:
    'bg-amber-400/20 text-amber-700 group-data-hover:bg-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400 dark:group-data-hover:bg-amber-400/15',
  green:
    'bg-green-500/15 text-green-700 group-data-hover:bg-green-500/25 dark:bg-green-500/10 dark:text-green-400 dark:group-data-hover:bg-green-500/20',
  note: 'bg-note-500/15 text-note-700 group-data-hover:bg-note-500/25 dark:bg-note-500/10 dark:text-note-300 dark:group-data-hover:bg-note-500/20',
  sky: 'bg-sky-500/15 text-sky-700 group-data-hover:bg-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300 dark:group-data-hover:bg-sky-500/20',
  zinc: 'bg-zinc-600/10 text-zinc-700 group-data-hover:bg-zinc-600/20 dark:bg-white/5 dark:text-zinc-400 dark:group-data-hover:bg-white/10',
}

export type BadgeColor = keyof typeof badgeColors
