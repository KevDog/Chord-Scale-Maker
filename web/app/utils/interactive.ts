import type { Directive } from 'vue'

/**
 * Headless UI React v2 marks interactive elements with data-hover / data-focus / data-active,
 * and Catalyst's classes style those attributes. @headlessui/vue doesn't, so this directive does.
 * `v-interactive` sets data-focus for keyboard (focus-visible) focus, like Headless UI buttons;
 * `v-interactive:any-focus` sets it for any focus, like Headless UI inputs and selects.
 */
type Cleanup = () => void
const cleanups = new WeakMap<HTMLElement, Cleanup>()

function flag(el: HTMLElement, name: string, on: boolean): void {
  if (on) el.setAttribute(`data-${name}`, '')
  else el.removeAttribute(`data-${name}`)
}

export const vInteractive: Directive<HTMLElement> = {
  mounted(el, binding) {
    const anyFocus = binding.arg === 'any-focus'
    const handlers: [string, (e: Event) => void][] = [
      ['pointerenter', (e) => flag(el, 'hover', (e as PointerEvent).pointerType !== 'touch')],
      ['pointerleave', () => (flag(el, 'hover', false), flag(el, 'active', false))],
      ['pointerdown', () => flag(el, 'active', true)],
      ['pointerup', () => flag(el, 'active', false)],
      ['pointercancel', () => flag(el, 'active', false)],
      ['focus', () => flag(el, 'focus', anyFocus || el.matches(':focus-visible'))],
      ['blur', () => flag(el, 'focus', false)],
    ]
    for (const [type, fn] of handlers) el.addEventListener(type, fn)
    cleanups.set(el, () => {
      for (const [type, fn] of handlers) el.removeEventListener(type, fn)
    })
  },
  unmounted(el) {
    cleanups.get(el)?.()
    cleanups.delete(el)
  },
}

/** `''` when on, `undefined` (attribute absent) when off: for :data-invalid, :data-disabled and so on */
export const dataFlag = (on: boolean | undefined): '' | undefined => (on ? '' : undefined)
