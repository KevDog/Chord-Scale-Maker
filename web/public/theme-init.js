// Apply the saved theme before first paint (default light). Kept in sync with app/composables/useTheme.ts.
try {
  if (localStorage.getItem('csm-theme') === 'dark') document.documentElement.classList.add('dark')
} catch {}
