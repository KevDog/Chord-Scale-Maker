/**
 * The form as played (#559, decision hear.form): the Changes sheet's drawn bars in the order a player reads them, once
 * through, for the click and Hear line to follow. Pure: the app loops it (web/app/composables/useClick.ts).
 */
import type { ChangesBar } from "./changes";

/** what a drawn bar says about where to go next (a ChangesBar's) */
export type PlayBar = Pick<
  ChangesBar,
  "at" | "repeatStart" | "repeatEnd" | "volta" | "segno" | "coda" | "nav"
>;

/** after a D.S. or D.C.: on to the Coda at the next coda sign, stop at Fine, or play on to the end */
type After = "coda" | "fine" | "end";

const isIntro = (b: PlayBar): boolean => /^intro/i.test(b.at.section);

/** each ending bar's last ending: the highest number in its run of ending bars (the one a D.S. plays) */
function lastEndings(bars: readonly PlayBar[]): readonly (number | null)[] {
  const out: (number | null)[] = bars.map(() => null);
  for (let i = 0; i < bars.length;) {
    if (!bars[i]!.volta) {
      i++;
      continue;
    }
    let j = i;
    while (j < bars.length && bars[j]!.volta) j++;
    const last = Math.max(...bars.slice(i, j).map((b) => b.volta!.n));
    for (let k = i; k < j; k++) out[k] = last;
    i = j;
  }
  return out;
}

const JUMP = /\bd\.\s?([sc])\./i;

/**
 * the drawn bars' indices in played order, once through: a repeat goes back to its start sign (else the form's top) as
 * many times in all as it says, each ending on its pass. A D.S. goes back to the segno and a D.C. to the form's first
 * bar (past an intro), at the end of the section it's written in, each once (a D.S. written again later, as a copied
 * section's, is read there instead); after it no repeat is taken and only the last ending plays, "al Fine" stops at
 * Fine, and "al Coda" leaves at the next coda sign or To Coda (with none, at the D.S.'s section end) for the Coda, which
 * plays to the end. The Coda is the first coda sign past the last D.S., else the sections named Coda; it is reached only
 * by its jump, and with no "al Coda" in the chart plays in place.
 */
export function playOrder(bars: readonly PlayBar[]): number[] {
  const navs = bars.map((b) => b.nav.toLowerCase());
  const jumps = navs.flatMap((n, i) =>
    JUMP.test(n) && navs.indexOf(n, i + 1) < 0 ? [i] : [],
  );
  const toCoda = jumps.some((i) => /al coda/.test(navs[i]!));
  const past = bars.findIndex((b, i) => b.coda && i > Math.max(...jumps));
  const inCodaSection = (i: number): boolean =>
    toCoda && /^coda/i.test(bars[i]!.at.section);
  const isCoda = toCoda && past >= 0 ? (i: number) => i >= past : inCodaSection;
  const codaAt =
    past >= 0
      ? past
      : Math.max(
          bars.findIndex((b, i) => b.coda && isCoda(i)),
          bars.findIndex((_, i) => isCoda(i)),
        );
  const sectionEnd = (i: number): boolean =>
    bars[i + 1]?.at.section !== bars[i]!.at.section;
  const top = Math.max(
    0,
    bars.findIndex((b, i) => !isIntro(b) && !isCoda(i)),
  );
  const segno = bars.findIndex((b, i) => b.segno && !isCoda(i));
  const last = lastEndings(bars);
  const out: number[] = [];
  let i = 0;
  let pass = 1;
  let repeatFrom = top;
  let after: After | null = null; // set where a D.S. or D.C. is read
  let jumpTo: number | null = null; // where it goes, at its section's end
  let jumpEnd = -1; // that section's last bar
  const taken = new Set<number>();
  let back = false; // past a D.S. or D.C.
  let inCoda = false;
  // a guard against a chart whose marks loop: no reading is longer than this
  while (i < bars.length && out.length < bars.length * 8) {
    const b = bars[i]!;
    if (isCoda(i) !== inCoda) {
      if (inCoda) break; // the Coda's end
      i++; // a Coda not jumped to
      continue;
    }
    if (b.repeatStart && !back) repeatFrom = i;
    if (b.volta && b.volta.n !== (back ? last[i] : pass)) {
      i++;
      continue;
    }
    out.push(i);
    const nav = navs[i]!;
    if (
      back &&
      after === "fine" &&
      /\bfine\b/.test(nav) &&
      !/al fine/.test(nav)
    )
      break;
    const leave =
      b.coda || /to coda/.test(nav) || (jumpTo === null && i === jumpEnd);
    if (back && after === "coda" && !inCoda && leave && codaAt >= 0) {
      inCoda = true;
      i = codaAt;
      continue;
    }
    const jump: RegExpExecArray | null =
      jumps.includes(i) && !taken.has(i) && jumpTo === null
        ? JUMP.exec(nav)
        : null;
    if (jump) {
      taken.add(i);
      after = /al coda/.test(nav)
        ? "coda"
        : /al fine/.test(nav)
          ? "fine"
          : "end";
      jumpTo = jump[1]!.toLowerCase() === "s" && segno >= 0 ? segno : top;
    }
    if (!back) {
      if (b.repeatEnd > 0 && pass < b.repeatEnd) {
        pass++;
        i = repeatFrom;
        continue;
      }
      // the repeat done: a pass count starts again past its last ending (or its end sign, with none)
      if (
        (b.repeatEnd > 0 && !bars[i + 1]?.volta) ||
        (b.volta?.end && b.volta.n === last[i])
      ) {
        pass = 1;
        repeatFrom = i + 1;
      }
    }
    if (jumpTo !== null && sectionEnd(i)) {
      jumpEnd = i;
      i = jumpTo;
      jumpTo = null;
      back = true;
      continue;
    }
    i++;
  }
  return out;
}
