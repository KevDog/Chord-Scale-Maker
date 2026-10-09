# Roadmap

Ideas agreed in principle but not scheduled, and work in progress. Each gets a plan or a PR of its own when it's
picked up.

## Next

### Architecture-audit leftovers (2026-10-09)

A multi-agent audit after the `v2-changes` tag found 13 items; the behavior-preserving refactors landed as PRs #69–78
(DRY of `keyText`/`isTonicType`/`shiftBy`/`spellEqual`/`defaultScaleOrNull`, dead-code and API-narrowing, shared
drawing constants and practice key, plus the `glyphs()` Bebop fix). Still open:

- **Contact email validation** — share the server `EMAIL` rule with the client pre-check (PR #79, left for review:
  it tightens user-facing validation).
- **Date-formatter DRY** — `EditorView.vue` and `MyChartsList.vue` share a today-vs-date formatter; low value and
  locale-string-sensitive, so deferred (not worth an unreviewed merge).
- **Engine coverage** — `voiceLeading.ts` (Viterbi) and `stream.ts` have no direct unit tests; adding them is pure
  upside but wants careful, fresh attention to avoid pinning current behavior as "correct".

## Done

### The Changes sheet

Feature-complete ([plan-changes.md](plan-changes.md)). 1st/2nd endings, D.C./segno navigation and coda symbols are
done via the `@ending`/`@segno`/`@coda`/`@nav` directives
([spec](superpowers/specs/2026-10-09-changes-navigation-design.md)).

### The cookbook's intros and codas

Intros, codas, tags and endings have a home (sections named `Intro`, `Coda`, `Tag`, `Ending`: outside the form).
The charts that noted a left-out intro, coda, tag or verse have had it transcribed from the lead sheets — played
chord-stab intros, coda turnarounds, tags and the odd verse (Stardust). The ones whose "left out" note is a melody
line with no chords (a horn intro) say so; a left-out *form* section or a sheet's *alternate* chords (Jingle Bells'
head, Cherokee's reharmonisations) are out of scope — they're not intros or codas.
