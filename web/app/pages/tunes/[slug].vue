<template>
  <article class="max-w-3xl space-y-10">
    <header class="space-y-3">
      <p class="mb-2 inline-block bg-note-100 px-2 py-0.5 font-display text-xs font-bold tracking-[0.2em] text-note-800 uppercase dark:bg-note-900 dark:text-note-200" aria-hidden="true">Library</p>
      <UiHeading>{{ summary.title }}</UiHeading>
      <UiText v-if="summary.composer" class="text-zinc-950! dark:text-white!">{{ summary.composer }}</UiText>
      <UiText v-if="details">{{ details }}</UiText>
      <UiText v-if="summary.source" class="text-sm/6!">Source: {{ summary.source }}</UiText>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
        <UiButton color="note" :href="`/song?chart=${chart.slug}`">Open practice sheets</UiButton>
        <UiText>Written for your instrument: the Changes, with guide tones, and the Scales.</UiText>
      </div>
    </header>

    <section class="space-y-4" aria-labelledby="changes">
      <UiSubheading id="changes">The changes</UiSubheading>
      <UiText>In concert pitch, each chord with its function and the scale it plays.</UiText>
      <UiTable dense class="[--gutter:--spacing(6)] lg:[--gutter:--spacing(10)]">
        <UiTableHead>
          <UiTableRow>
            <UiTableHeader>Section</UiTableHeader>
            <UiTableHeader>Bar</UiTableHeader>
            <UiTableHeader>Chord</UiTableHeader>
            <UiTableHeader>Function</UiTableHeader>
            <UiTableHeader>Scale</UiTableHeader>
          </UiTableRow>
        </UiTableHead>
        <UiTableBody>
          <UiTableRow v-for="(r, i) in summary.rows" :key="i">
            <UiTableCell class="font-medium text-zinc-950 dark:text-white">{{ i === 0 || summary.rows[i - 1]?.section !== r.section ? r.section : '' }}</UiTableCell>
            <UiTableCell>{{ r.bar }}</UiTableCell>
            <UiTableCell class="font-medium text-zinc-950 dark:text-white">{{ r.chord }}</UiTableCell>
            <UiTableCell>{{ r.numeral }}</UiTableCell>
            <UiTableCell>{{ r.scale ?? '' }}</UiTableCell>
          </UiTableRow>
        </UiTableBody>
      </UiTable>
    </section>

    <UiText>
      <UiTextLink href="/functions">How the scales are chosen</UiTextLink>, or back to the <UiTextLink href="/">chart library</UiTextLink>.
    </UiText>
  </article>
</template>

<script setup lang="ts">
import { tuneDescription, tuneSummary } from '@chord-scale-maker/engine'
import { findTune } from '~/utils/library'
import { seoMeta, tuneTitle } from '~/utils/site'

const route = useRoute()
const found = findTune(String(route.params.slug))
if (!found) throw createError({ statusCode: 404, statusMessage: 'Tune not found', fatal: true })
const chart = found
const summary = tuneSummary(chart.text)
const details = [summary.style, summary.keyLabel, summary.form, summary.time].filter(Boolean).join(' · ')

useSeoMeta(seoMeta({ title: tuneTitle(summary), description: tuneDescription(summary) }))
</script>
