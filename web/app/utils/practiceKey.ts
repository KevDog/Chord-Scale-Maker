import type { Mode } from '~~/engine'

/** the localStorage key a chart's practice selection is stored under, per mode: "csm-practice:<slug>:<mode>" */
export const practiceKey = (slug: string, mode: Mode): string => `csm-practice:${slug}:${mode}`
