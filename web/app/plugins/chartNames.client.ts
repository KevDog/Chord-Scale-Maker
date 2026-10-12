// chart files were renamed to hyphens: carry over what this browser saved under the old names (utils/myCharts.ts)
export default defineNuxtPlugin(() => {
  migrateChartNames()
})
