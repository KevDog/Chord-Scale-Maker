/** a library chart as the site may ship it: source: (and a `# source:` note) says where the chart came from, for
 * internal use only */
export const publishedChart = (text: string): string => text.replace(/^(?:#\s*)?source:.*(?:\r?\n|$)/gm, '')
