# Roadmap

Ideas agreed in principle but not scheduled. Each gets a plan or a PR of its own when it's picked up.

## Intros, codas, tags and endings

**Today:** a chart has no notion of them. Section labels are free text and the whole chart is one repeating form:
every row prints, and the analyser (plan-analysis.md) treats the last chord as resolving to the first. The 222
Colorado Cookbook charts leave intros, codas, tags, vamps and endings out, and 43 of them say so in a comment
(`# the intro vamp (Db7#9 C7#9) … is left out`).

**Proposal:** sections named `Intro`, `Coda`, `Tag` or `Ending` (matched case-insensitively, with an optional number:
`Tag 2`) print like any other, but sit outside the form.

- The analyser leaves them out of the repeating form: the turnaround into the top resolves to the form's first bar,
  not the intro's, and they don't open or close key areas for the form. Each is analysed on its own, in the key it
  sits next to (an intro in the key of bar 1, a coda or ending in the key of the form's last bar).
- Sheets print them where they stand in the chart, with the section label as written.
- The help page and README describe the convention; `form:` counts only the form's bars.
- The cookbook charts' left-out intros and codas could then be added from the lead sheets.

**Open questions:** whether a vamp that repeats "on cue" needs a repeat mark on the sheet, and whether a coda
should print after a visual break.
