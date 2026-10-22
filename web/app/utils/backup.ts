import { applyChoices, type Backup, backupFileName, backupFrom, type ImportChoices, type ImportPlan, type ImportStep, planImport, serializeBackup } from '@chord-scale-maker/engine'
import { MY_CHARTS_MAX, newChartId, savedRevision } from '~/utils/myCharts'
import { readStored, removeStored, storedKeys, tryWriteStored } from '~/utils/storage'

/**
 * Back up and restore (#466): the engine (engine/src/backup.ts) makes the file and plans the merge; this reads this
 * browser's storage for it and carries the plan out. A restore writes nothing past My charts' limit, and each item
 * either lands whole or is put back as it was, so a full browser stops with a report of what landed.
 */
export type RestoreResult =
  | Readonly<{ ok: true; written: readonly string[] }>
  | Readonly<{ ok: false; reason: 'full' | 'tooMany'; written: readonly string[]; notWritten: readonly string[] }>

/** every key this browser's localStorage holds, with its value */
export const snapshot = (): Record<string, string> =>
  Object.fromEntries(storedKeys().flatMap((k): [string, string][] => {
    const v = readStored(k)
    return v === null ? [] : [[k, v]]
  }))

/** the backup file for everything kept here: its name and its text */
export function backupDownload(version: string, now = new Date()): Readonly<{ filename: string; text: string }> {
  return { filename: backupFileName(now), text: serializeBackup(backupFrom(snapshot(), { exportedAt: now.toISOString(), version })) }
}

/** a backup against what this browser holds now */
export const planRestore = (backup: Backup): ImportPlan => planImport(snapshot(), backup)

/** one step's removes then writes; on a failed write, every key it touched goes back to what it held */
function runStep(step: ImportStep): boolean {
  const touched = [...new Set([...step.removes, ...step.writes.map(([k]) => k)])]
  const before = touched.map((k) => [k, readStored(k)] as const)
  for (const k of step.removes) removeStored(k)
  if (step.writes.every(([k, v]) => tryWriteStored(k, v))) return true
  for (const [k] of before) removeStored(k)
  for (const [k, v] of before) if (v !== null) tryWriteStored(k, v)
  return false
}

/** carry out a plan with these choices */
export function restore(plan: ImportPlan, choices: ImportChoices, newId: () => string = newChartId): RestoreResult {
  const { steps, charts } = applyChoices(plan, choices, newId)
  const labels = steps.map((s) => s.label)
  if (charts > MY_CHARTS_MAX) return { ok: false, reason: 'tooMany', written: [], notWritten: labels }
  const stopped = steps.findIndex((s) => !runStep(s))
  if (steps.slice(0, stopped < 0 ? steps.length : stopped).some((s) => s.kind === 'chart')) savedRevision.value++
  return stopped < 0 ? { ok: true, written: labels } : { ok: false, reason: 'full', written: labels.slice(0, stopped), notWritten: labels.slice(stopped) }
}
