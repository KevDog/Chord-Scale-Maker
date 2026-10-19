/** Catalyst's listbox button (ui/Listbox.vue), shared by buttons that open a panel but read as a select (RailPopover's summary) */
export const LISTBOX_BUTTON = [
  // Basic layout
  'group relative block w-full',
  // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
  'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
  // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
  'dark:before:hidden',
  // Hide default focus styles
  'focus:outline-hidden',
  // Focus ring
  'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset data-focus:after:ring-2 data-focus:after:ring-blue-500',
  // Disabled state
  'data-disabled:opacity-50 data-disabled:before:bg-zinc-950/5 data-disabled:before:shadow-none',
]
export const LISTBOX_SELECTED = [
  // Basic layout
  'relative block w-full appearance-none rounded-lg py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
  // Set minimum height for when no value is selected
  'min-h-11 sm:min-h-9',
  // Horizontal padding
  'pr-[calc(--spacing(7)-1px)] pl-[calc(--spacing(3.5)-1px)] sm:pl-[calc(--spacing(3)-1px)]',
  // Typography
  'text-left text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white forced-colors:text-[CanvasText]',
  // Border (has-data-open: Headless UI React's data-active while the menu is open)
  'border border-zinc-950/10 group-data-active:border-zinc-950/20 group-has-data-open:border-zinc-950/20 group-data-hover:border-zinc-950/20 dark:border-white/10 dark:group-data-active:border-white/20 dark:group-has-data-open:border-white/20 dark:group-data-hover:border-white/20',
  // Background color
  'bg-transparent dark:bg-white/5',
  // Invalid state
  'group-data-invalid:border-red-500 group-data-hover:group-data-invalid:border-red-500 dark:group-data-invalid:border-red-600 dark:data-hover:group-data-invalid:border-red-600',
  // Disabled state
  'group-data-disabled:border-zinc-950/20 group-data-disabled:opacity-100 dark:group-data-disabled:border-white/15 dark:group-data-disabled:bg-white/2.5 dark:group-data-disabled:data-hover:border-white/15',
]
