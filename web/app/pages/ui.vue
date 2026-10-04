<template>
  <div class="space-y-12">
    <div>
      <UiHeading>Component showcase</UiHeading>
      <UiText>Catalyst components ported to Vue. Development only: this page is not in the production build.</UiText>
    </div>

    <section class="space-y-4">
      <UiSubheading>Buttons</UiSubheading>
      <div class="flex flex-wrap items-center gap-3">
        <UiButton>Dark/zinc</UiButton>
        <UiButton color="teal">Teal</UiButton>
        <UiButton color="white">White</UiButton>
        <UiButton color="red">Red</UiButton>
        <UiButton outline>Outline</UiButton>
        <UiButton plain>Plain</UiButton>
        <UiButton color="teal" disabled>Disabled</UiButton>
        <UiButton href="/">As a link</UiButton>
        <UiButton plain aria-label="Add row"><PlusIcon data-slot="icon" /></UiButton>
        <UiButton color="teal"><PrinterIcon data-slot="icon" />Print</UiButton>
      </div>
    </section>

    <section class="grid gap-8 sm:grid-cols-2">
      <UiFieldset>
        <UiLegend>Form controls</UiLegend>
        <UiText>Fields wire their label, description and error to the control.</UiText>
        <UiFieldGroup>
          <UiField>
            <UiLabel>Title</UiLabel>
            <UiDescription>Printed at the top of every page.</UiDescription>
            <UiInput v-model="title" />
          </UiField>
          <UiField>
            <UiLabel>Chord</UiLabel>
            <UiInput v-model="chord" invalid />
            <UiErrorMessage>May not contain | or line breaks.</UiErrorMessage>
          </UiField>
          <UiField>
            <UiLabel>Search</UiLabel>
            <UiInputGroup>
              <MagnifyingGlassIcon data-slot="icon" />
              <UiInput v-model="search" type="search" placeholder="Search by title" />
            </UiInputGroup>
          </UiField>
          <UiField>
            <UiLabel>Start on</UiLabel>
            <UiSelect v-model="start">
              <option v-for="r in ['C', 'Eb', 'F', 'Bb']" :key="r" :value="r">{{ r }}</option>
            </UiSelect>
          </UiField>
          <UiField disabled>
            <UiLabel>Disabled</UiLabel>
            <UiInput model-value="Can't edit" />
          </UiField>
          <UiField>
            <UiLabel>Chart text</UiLabel>
            <UiTextarea v-model="text" class="font-mono" rows="4" />
          </UiField>
        </UiFieldGroup>
      </UiFieldset>

      <div class="space-y-8">
        <UiField>
          <UiLabel>Instrument (Listbox with groups)</UiLabel>
          <UiListbox v-model="instrument" aria-label="Instrument">
            <template #selected="{ value }"><UiListboxLabel>{{ value }}</UiListboxLabel></template>
            <UiListboxHeader>Concert pitch (C)</UiListboxHeader>
            <UiListboxOption value="concert"><UiListboxLabel>Concert</UiListboxLabel></UiListboxOption>
            <UiListboxOption value="piano"><UiListboxLabel>Piano</UiListboxLabel></UiListboxOption>
            <UiListboxHeader>B♭ instruments</UiListboxHeader>
            <UiListboxOption value="trumpet"><UiListboxLabel>Trumpet</UiListboxLabel></UiListboxOption>
            <UiListboxOption value="tenor-sax">
              <UiListboxLabel>Tenor sax</UiListboxLabel><UiListboxDescription>sounds an octave lower</UiListboxDescription>
            </UiListboxOption>
          </UiListbox>
        </UiField>

        <div class="space-y-2">
          <UiSubheading>Badges</UiSubheading>
          <div class="flex flex-wrap gap-2">
            <UiBadge v-for="c in BADGES" :key="c" :color="c">{{ c }}</UiBadge>
          </div>
        </div>

        <div class="space-y-2">
          <UiSubheading>Text</UiSubheading>
          <UiText>
            Body text with a <UiTextLink href="/">link</UiTextLink>, <UiStrong>strong</UiStrong> words and
            <UiCode>A | 1 | Cm7</UiCode> code.
          </UiText>
        </div>

        <div class="space-y-2">
          <UiSubheading>Dialog</UiSubheading>
          <UiButton outline @click="dialog = true">Open dialog</UiButton>
          <UiDialog :open="dialog" @close="dialog = false">
            <UiDialogTitle>Choose a scale</UiDialogTitle>
            <UiDialogDescription>Any root and any of the 23 scales.</UiDialogDescription>
            <UiDialogBody><UiText>Body content.</UiText></UiDialogBody>
            <UiDialogActions>
              <UiButton plain @click="dialog = false">Cancel</UiButton>
              <UiButton color="teal" @click="dialog = false">Set</UiButton>
            </UiDialogActions>
          </UiDialog>
        </div>
      </div>
    </section>

    <UiDivider />

    <section class="space-y-4">
      <UiSubheading>Table (dense)</UiSubheading>
      <UiTable dense>
        <UiTableHead>
          <UiTableRow><UiTableHeader>Section</UiTableHeader><UiTableHeader>Bar</UiTableHeader><UiTableHeader>Chord</UiTableHeader><UiTableHeader>Scale</UiTableHeader></UiTableRow>
        </UiTableHead>
        <UiTableBody>
          <UiTableRow v-for="r in ROWS" :key="r.join()">
            <UiTableCell v-for="c in r" :key="c">{{ c }}</UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
    </section>
  </div>
</template>

<script setup lang="ts">
import { MagnifyingGlassIcon, PlusIcon, PrinterIcon } from '@heroicons/vue/16/solid'
import type { BadgeColor } from '~/utils/catalyst/badge'

const title = ref('Autumn Leaves')
const chord = ref('C|7')
const search = ref('')
const start = ref('C')
const text = ref('A | 1 | Cm7\nA | 2 | F7\n')
const instrument = ref('tenor-sax')
const dialog = ref(false)
const BADGES: readonly BadgeColor[] = ['zinc', 'teal', 'sky', 'amber', 'red', 'green']
const ROWS = [
  ['A1', '1', 'Cm7', 'C Dorian'],
  ['A1', '2', 'F7', 'F Mixolydian'],
  ['A1', '3', 'Bm7', 'B Dorian'],
]
useHead({ title: 'Components · Chord Scale Maker' })
</script>
