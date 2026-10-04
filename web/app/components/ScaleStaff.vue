<template>
  <div class="grid grid-cols-[8rem_1fr] items-center gap-3 break-inside-avoid print:grid-cols-[8.5rem_1fr]">
    <div class="text-right leading-tight">
      <div class="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">{{ staff.section }} · Bar {{ staff.bar }}</div>
      <div class="text-lg font-semibold"><ChordSymbol v-if="staff.chord" :tokens="staff.chord" /><span v-else>—</span></div>
      <div v-if="staff.scale" class="whitespace-nowrap text-sm italic"><NoteName :note="staff.scale.root" /> {{ staff.scale.name }}</div>
    </div>
    <div v-if="staff.error" class="rounded border border-dashed border-amber-500 px-3 py-6 text-sm text-amber-700 dark:text-amber-400">
      {{ staff.error }}
    </div>
    <div v-else ref="el" class="text-slate-900 dark:text-slate-100 print:text-black" />
  </div>
</template>

<script setup lang="ts">
import type { StaffModel } from '~~/engine'

const props = defineProps<{ staff: StaffModel; clef: 'treble' | 'bass' }>()
const el = useTemplateRef<HTMLDivElement>('el')

async function draw(): Promise<void> {
  if (props.staff.error) return
  const vf = await loadVexFlow()
  if (el.value) drawStaff(vf, el.value, props.staff, props.clef)
}

onMounted(draw)
watch(() => [props.staff.id, props.staff.last, props.clef], () => nextTick(draw))
</script>
