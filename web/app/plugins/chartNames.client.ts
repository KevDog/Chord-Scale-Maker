// chart files were renamed to hyphens: carry over what this browser saved under the old names; then drop what deleted
// charts left behind (utils/myCharts.ts)
export default defineNuxtPlugin(() => {
  migrateChartNames()
  sweepOrphans()
})
