import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import UiBadge from '~/components/ui/Badge.vue'
import UiHeading from '~/components/ui/Heading.vue'
import UiNavbarItem from '~/components/ui/NavbarItem.vue'
import UiTable from '~/components/ui/Table.vue'
import UiTableBody from '~/components/ui/TableBody.vue'
import UiTableCell from '~/components/ui/TableCell.vue'
import UiTableRow from '~/components/ui/TableRow.vue'

describe('display components', () => {
  it('Badge takes a colour', async () => {
    const w = await mountSuspended(UiBadge, { props: { color: 'teal' }, slots: { default: 'copy' } })
    expect(w.classes()).toContain('bg-teal-500/15')
  })

  it('Heading renders the requested level', async () => {
    const w = await mountSuspended(UiHeading, { props: { level: 2 }, slots: { default: 'Library' } })
    expect(w.element.tagName).toBe('H2')
  })

  it('Table passes dense / striped to rows and cells', async () => {
    const T = defineComponent({
      components: { UiTable, UiTableBody, UiTableRow, UiTableCell },
      template: '<UiTable dense striped><UiTableBody><UiTableRow><UiTableCell>x</UiTableCell></UiTableRow></UiTableBody></UiTable>',
    })
    const w = await mountSuspended(T)
    expect(w.find('td').classes()).toContain('py-2.5')
    expect(w.find('td').classes()).not.toContain('border-b')
    expect(w.find('tr').classes()).toContain('even:bg-zinc-950/2.5')
  })

  it('Table options stay reactive', async () => {
    const T = defineComponent({
      components: { UiTable, UiTableBody, UiTableRow, UiTableCell },
      props: { dense: Boolean },
      template: '<UiTable :dense="dense"><UiTableBody><UiTableRow><UiTableCell>x</UiTableCell></UiTableRow></UiTableBody></UiTable>',
    })
    const w = await mountSuspended(T)
    expect(w.find('td').classes()).toContain('py-4')
    await w.setProps({ dense: true })
    expect(w.find('td').classes()).toContain('py-2.5')
  })

  it('NavbarItem marks the current page', async () => {
    const w = await mountSuspended(UiNavbarItem, { props: { href: '/', current: true }, slots: { default: 'Library' } })
    expect(w.find('a').attributes('aria-current')).toBe('page')
    expect(w.findAll('span.absolute').length).toBeGreaterThan(0)
    const plain = await mountSuspended(UiNavbarItem, { attrs: { 'aria-label': 'Menu', class: 'max-lg:hidden' }, slots: { default: 'M' } })
    expect(plain.find('button').attributes('aria-label')).toBe('Menu') // attributes reach the button
    expect(plain.classes()).toContain('max-lg:hidden') // class stays on the wrapper
  })
})
