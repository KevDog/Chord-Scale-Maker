# Phase 1: Scale Engine Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `jazz_scales.py` scale engine to pure TypeScript, proven identical to Python by golden fixtures, and make the chart scale column optional in both engines.

**Architecture:** Python stays the reference implementation. `tools/export_fixtures.py` records Python's answers in `fixtures/golden.json`, and vitest checks that the TS engine (`web/engine/`, pure functions, no Vue/DOM) gives the same answers. Both engines read `chord_scales.json` to pick a default scale when a chart row omits one. There's no UI in this phase: `web/` is a plain TS + vitest package, and Nuxt is added in phase 2.

**Tech Stack:** Python 3.8+ (stdlib only) + pytest; TypeScript 5.9 (strict), vitest 5, Node 24; GitHub Actions.

Specs: [requirements.md](requirements.md), [design.md](design.md). The code below has been run: 12 pytest + 37 vitest tests pass, and `tsc --noEmit` is clean.

---

## Background for the implementer

- A **chart** is concert-pitch text: `section | bar | chord | scale` rows, `title:`/`subtitle:` lines, `#` comments, and `@copy SRC DST OFFSET` (repeat section SRC as DST with bars shifted). See README.md.
- A **scale** is computed from a degree formula (`"1 2 b3 4 5 6 b7"` = Dorian) on a spelled root. Spelling uses letter steps, so a degree's letter is fixed and only its accidental varies.
- A **Part** is an instrument view: a clef plus a transposition (C, Bb, Eb, F). Transposed roots are respelled by `simplify_root` (avoid B#/E#/Cb/Fb and double accidentals, then use the fewest accidentals, then keep the sharp/flat direction).
- **Modes:** `root` writes each scale up from its own root in a fixed clef range. `from` writes the octave starting at a fixed written pitch.
- Python's `%` is always non-negative and JS's isn't, so TS uses the `mod()` helper everywhere Python uses `%`.
- Python's LilyPond chord markup becomes `ChordToken[]` in TS (text runs and accidentals, adjacent text merged). The exporter converts Python's markup to the same token format.

## File structure

| File | Responsibility |
|---|---|
| `jazz_scales.py` (modify) | load `chord_scales.json`; `scale_options`, `default_scale`; optional scale column |
| `tests/test_jazz_scales.py` (modify) | tests for the above |
| `tools/export_fixtures.py` (create) | build/write `fixtures/golden.json` from Python |
| `tests/test_fixtures.py` (create) | fails if the fixture is stale |
| `fixtures/golden.json` (generated, committed) | Python's answers |
| `web/package.json`, `tsconfig.json`, `vitest.config.ts` (create) | TS package |
| `web/engine/pitch.ts` | letters, pitch classes, accidentals, enharmonics |
| `web/engine/scales.ts` | SCALES, ALIASES, spelling, `simplifyRoot`, `parseScale` |
| `web/engine/instruments.ts` | transpositions, instrument presets, clef ranges |
| `web/engine/part.ts` | written roots, scale notes per mode, labels, start notes |
| `web/engine/chord.ts` | chord parsing, display tokens |
| `web/engine/qualities.ts` | quality lookup from `chord_scales.json`, options, default |
| `web/engine/limits.ts` | input caps |
| `web/engine/chart.ts` | chart text ⇄ `ChartDoc`, `@copy` expansion, scale resolution |
| `web/engine/index.ts` | public barrel |
| `web/engine/__tests__/*.test.ts` | unit tests + golden parity |
| `Makefile`, `.gitignore`, `.github/workflows/ci.yml`, `CLAUDE.md`, `README.md` (modify/create) | tooling, docs |

---

### Task 0: Baseline

**Files:** Modify: `.gitignore`

- [ ] **Step 1: Create a venv with pytest** (Homebrew Python blocks global `pip install`)

```bash
python3 -m venv .venv && .venv/bin/python -m pip install -q pytest
```

- [ ] **Step 2: Ignore the venv and node_modules.** Append to `.gitignore`:

```text
.venv/
web/node_modules/
```

- [ ] **Step 3: Run existing tests**

Run: `.venv/bin/python -m pytest -q tests`
Expected: `7 passed`

- [ ] **Step 4: Initial commit on main, then branch**

```bash
git add -A && git commit -m "chore: initial import of jazz_scales CLI, docs and chart"
git switch -c phase1-engine
```

---

### Task 1: Python: chord quality → scale options

**Files:** Modify: `jazz_scales.py`, `tests/test_jazz_scales.py`

- [ ] **Step 1: Write the failing tests.** Append to `tests/test_jazz_scales.py`:

```python
def test_default_scale_from_quality():
    assert j.default_scale("Cm7") == "C Dorian"
    assert j.default_scale("F7") == "F Mixolydian"
    assert j.default_scale("Gm") == "G Dorian"
    assert j.default_scale("C") == "C Ionian"
    assert j.default_scale("EbMaj7") == "Eb Ionian"
    assert j.default_scale("C6/9") == "C Ionian"
    assert j.default_scale("D7/F#") == "D Mixolydian"
    assert j.default_scale("Am7b5") == "A Locrian"
    assert j.default_scale("Bb-7") == "Bb Dorian"
    try:
        j.default_scale("Cm7#5#9x")
        assert False
    except ValueError:
        pass


def test_scale_options_interval_roots():
    opts = j.scale_options("Cm7")
    assert [o["scale"] for o in opts if o["default"]] == ["C Dorian"]
    assert "Eb Major Pentatonic" in [o["scale"] for o in opts]
    assert "D Major Pentatonic" in [o["scale"] for o in j.scale_options("Gbm7b5")]   # b6 of Gb = Ebb -> D
    assert "B Melodic Minor" in [o["scale"] for o in j.scale_options("Bb7alt")]      # b2 of Bb = Cb -> B


def test_every_json_scale_is_known():
    for quality, opts in j.QUALITIES.items():
        for o in opts:
            j.parse_scale("C " + o["scale"])
        assert sum(1 for o in opts if o.get("default")) == 1, quality
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest -q tests`
Expected: 3 FAIL with `AttributeError: module 'jazz_scales' has no attribute 'default_scale'` (or `QUALITIES`)

- [ ] **Step 3: Implement.** In `jazz_scales.py`, add `json` to the imports:

```python
import argparse, json, math, re, shutil, subprocess, sys
```

Insert this block between `parse_scale` and `spell_scale`:

```python
# --- chord qualities -> default/alternate scales (chord_scales.json) -------
CHORD_RE = r"([A-G])([b#♭♯]?)(.*?)(?:/([A-G])([b#♭♯]?))?"
_qdata = json.loads(Path(__file__).resolve().with_name("chord_scales.json").read_text(encoding="utf-8"))
QUALITIES = _qdata["qualities"]
QUALITY_LOOKUP = {q: q for q in QUALITIES}
for _q, _names in _qdata["quality_aliases"].items():
    QUALITY_LOOKUP.update({n: _q for n in _names})


def scale_options(chord):
    """-> [{'scale': 'Eb Major Pentatonic', 'note': '...', 'default': bool}] for a chord symbol"""
    m = re.fullmatch(CHORD_RE, chord.strip())
    if not m:
        raise ValueError(f"cannot parse chord {chord!r}")
    quality = QUALITY_LOOKUP.get(m.group(3))
    if quality is None:
        raise ValueError(f"unknown chord quality {m.group(3)!r} in {chord!r}; give a scale")
    li, acc = parse_root(m.group(1) + m.group(2))
    out = []
    for opt in QUALITIES[quality]:
        key = norm(opt["scale"])
        key = ALIASES.get(key, key)
        l, a, _ = spell_from(li, acc, opt["root"])[0]
        if opt["root"] != "1":      # interval-derived root: friendliest spelling for its scale
            l, a = simplify_root(l, a, key)
        out.append({"scale": f"{root_name(l, a)} {opt['scale']}",
                    "note": opt.get("note", ""), "default": bool(opt.get("default"))})
    return out


def default_scale(chord):
    opts = scale_options(chord)
    return next((o for o in opts if o["default"]), opts[0])["scale"]
```

In `Part.chord_markup`, reuse the shared regex. Replace

```python
        m = re.fullmatch(r"([A-G])([b#♭♯]?)(.*?)(?:/([A-G])([b#♭♯]?))?", txt.strip())
```

with

```python
        m = re.fullmatch(CHORD_RE, txt.strip())
```

Why it works: the lazy quality group plus the optional `/[A-G]` bass means `C6/9` gives quality `6/9` (no bass), while `D7/F#` gives quality `7` and bass `F#`. That's design decision 3, with no extra code. The interval root (`"b3"`) is spelled by reusing `spell_from` with a one-degree formula, then respelled by `simplify_root` for its scale (so `b2` over Bb gives B Melodic Minor, not Cb). A root the user wrote (`"1"`) is kept as written.

- [ ] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest -q tests`
Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add jazz_scales.py tests/test_jazz_scales.py
git commit -m "feat(cli): default and alternate scales from chord_scales.json"
```

---

### Task 2: Python: optional scale column

**Files:** Modify: `jazz_scales.py` (`read_chart`), `tests/test_jazz_scales.py`, `README.md`

- [ ] **Step 1: Write the failing test.** Append:

```python
def test_chart_rows_may_omit_scale(tmp_path):
    f = tmp_path / "t.txt"
    f.write_text("A | 1 | Cm7\nA | 2 | F7 |\nA | 3 | Gm | G Aeolian\n")
    _, _, rows = j.read_chart(f)
    assert [r[3] for r in rows] == ["C Dorian", "F Mixolydian", "G Aeolian"]
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest -q tests -k omit`
Expected: FAIL with `SystemExit: line 1: expected  section | bar | chord | scale`

- [ ] **Step 3: Implement.** In `read_chart`, replace

```python
            cells = [c.strip() for c in line.split("|")]
            if len(cells) != 4:
                sys.exit(f"line {n}: expected  section | bar | chord | scale")
            rows.append(tuple(cells))
```

with

```python
            cells = [c.strip() for c in line.split("|")]
            if len(cells) == 3:
                cells.append("")
            if len(cells) != 4:
                sys.exit(f"line {n}: expected  section | bar | chord [| scale]")
            if not cells[3]:
                try:
                    cells[3] = default_scale(cells[2])
                except ValueError as e:
                    sys.exit(f"line {n}: {e}")
            rows.append(tuple(cells))
```

- [ ] **Step 4: Run tests and the CLI**

Run: `.venv/bin/python -m pytest -q tests && python3 jazz_scales.py charts/autumn_leaves.txt --no-pdf -o output/check`
Expected: `11 passed`, then `wrote output/check.ly`

- [ ] **Step 5: Document it.** In `README.md`, replace the table row

```markdown
| `section \| bar \| chord \| scale` | One row per chord. Two chords in a bar are two rows with the same bar number. |
```

with

```markdown
| `section \| bar \| chord \| scale` | One row per chord. Two chords in a bar are two rows with the same bar number. |
| `section \| bar \| chord` | Scale omitted: the chord quality's default from `chord_scales.json` is used (e.g. `Cm7` → `C Dorian`). |
```

- [ ] **Step 6: Commit**

```bash
git add jazz_scales.py tests/test_jazz_scales.py README.md
git commit -m "feat(cli): chart scale column is optional"
```

---

### Task 3: Golden fixture exporter

**Files:** Create: `tools/export_fixtures.py`, `tests/test_fixtures.py`, `fixtures/golden.json` (generated)

- [ ] **Step 1: Write the failing freshness test**

`tests/test_fixtures.py`:

```python
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import export_fixtures


def test_golden_fixture_is_up_to_date():
    assert export_fixtures.FIXTURE.read_text(encoding="utf-8") == export_fixtures.render(), \
        "fixtures/golden.json is stale: run  python3 tools/export_fixtures.py"
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest -q tests/test_fixtures.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'export_fixtures'`

- [ ] **Step 3: Write the exporter.** It covers 21 roots × 23 scales plus aliases, JSON scale names and invalid inputs, across 5 parts and 5 `from` starts; start-note resolution; 40 chords (4 unparseable) × 5 parts with and without their default scale, plus chord/scale pairs whose roots differ or are spelled differently; quality options/defaults; and every chart in `charts/` plus two inline charts (3-cell rows, CRLF, `TITLE:`, negative/zero `@copy`). Each chart's text is stored in the fixture so the TS test parses the same input. The token converter asserts that it consumed the whole markup, so a new LilyPond construct fails loudly instead of being dropped.

`tools/export_fixtures.py`:

```python
#!/usr/bin/env python3
"""Write fixtures/golden.json: jazz_scales.py's answers for the TS engine's parity tests.

Run after any change to jazz_scales.py, chord_scales.json or charts/:
  python3 tools/export_fixtures.py
"""
import json, re, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import jazz_scales as j  # noqa: E402

FIXTURE = ROOT / "fixtures" / "golden.json"
PARTS = {f"{c}/{t}": (c, t) for c, t in
         [("treble", "C"), ("treble", "Bb"), ("treble", "Eb"), ("treble", "F"), ("bass", "C")]}
ROOTS = [l + a for l in "CDEFGAB" for a in ("b", "", "#")]
FROM_STARTS = ["C", "Eb", "F#3", "G2", "Bb5"]
START_TEXTS = ["C", "Eb", "F#3", "Cb", "B#", "G2", "Bb5", "f#"]
SCALE_TEXTS = ([f"{r} {k}" for r in ROOTS for k in j.SCALES]
               + [f"D {a}" for a in j.ALIASES]
               + sorted({f"Eb {o['scale']}" for opts in j.QUALITIES.values() for o in opts})
               + ["C Dorain", "H Dorian", "C", "Bb  half-whole dim."])
CHORDS = ["Cm7", "C-7", "Cmi7", "Cmin7", "Bbm7", "Am7b5", "D7#5", "G7#9b13", "EbMaj7", "Cmaj7",
          "CMaj7", "C9", "D7/F#", "Cm6/Eb", "C6/9", "Cm6/9", "F#m7", "Gm", "C", "Bm7", "Db7(b9)",
          "Abmin7", "E7alt", "Bb7sus4", "F#ø7", "Cdim7", "Gbm7b5", "C#m7", "B7b9", "E7(#11)",
          "Fmaj7#11", "Bb13", "Ebm(maj7)", "Ab7/Gb", "G/B", "Cm7#5#9x",
          "H7", "C7/", "", "Cmaj7/x"]                                  # unparseable
# chord + scale whose roots differ, or share a pitch but not a spelling
CHORD_SCALE_PAIRS = [("C7", "F# Locrian"), ("Db7", "C# Mixolydian"), ("C#m7", "Db Dorian"),
                     ("Gb7/Bb", "F# Mixolydian"), ("D7/F#", "Ab Altered")]
# inline charts for parser paths the library files don't hit
CHART_TEXTS = {
    "inline_defaults": "TITLE: Defaults\r\nA | 1 | Cm7\r\nA | 2 | F7 |\r\nA | 3 | Bbmaj7 | Bb Lydian\r\n",
    "inline_copy": "title: Copy\nsubtitle: Neg\n# c\nA | 9 | Dm7b5\nA | 10 | G7alt\n@copy A B -8\n@copy B C 0\n",
}


def start_for(clef, text):
    exact, pc = j.parse_start(text)
    base = j.CLEF_START[clef]
    return exact if exact is not None else base + (pc - base) % 12


def scale_case(part, text):
    try:
        li, acc, key, _ = part.scale(text)
    except ValueError:
        return {"error": True}
    return {"root": j.root_name(li, acc), "label": j.SCALES[key][1],
            "root_notes": part.scale_notes(text, "root", 0),
            "from": {s: part.scale_notes(text, "from", start_for(part.clef, s)) for s in FROM_STARTS}}


def tokens(markup):
    """LilyPond chord markup -> [{kind: text|acc}], adjacent text merged"""
    body = re.fullmatch(r"\\concat \{ (.*) \}", markup).group(1)
    pieces = list(re.finditer(r'"([^"]*)"|\\(fl|sh)', body))
    assert re.sub(r'"[^"]*"|\\(fl|sh)', "", body).strip() == "", f"unexpected markup: {markup}"
    out = []
    for m in pieces:
        if m.group(1) is None:
            out.append({"kind": "acc", "acc": "b" if m.group(2) == "fl" else "#"})
        elif out and out[-1]["kind"] == "text":
            out[-1] = {"kind": "text", "text": out[-1]["text"] + m.group(1)}
        else:
            out.append({"kind": "text", "text": m.group(1)})
    return out


def maybe(f, *a):
    try:
        return f(*a)
    except ValueError:
        return None


def build():
    parts = {pid: j.Part(c, t) for pid, (c, t) in PARTS.items()}
    chords = []
    for pid, part in parts.items():
        for chord in CHORDS:
            for scale in dict.fromkeys([None, maybe(j.default_scale, chord)]):
                toks = maybe(lambda: tokens(part.chord_markup(chord, scale)))
                chords.append({"part": pid, "chord": chord, "scale": scale, "tokens": toks})
        for chord, scale in CHORD_SCALE_PAIRS:
            chords.append({"part": pid, "chord": chord, "scale": scale,
                           "tokens": maybe(lambda: tokens(part.chord_markup(chord, scale)))})
    texts = {f.stem: f.read_text(encoding="utf-8") for f in sorted((ROOT / "charts").glob("*.txt"))}
    texts.update(CHART_TEXTS)
    charts = {}
    with tempfile.TemporaryDirectory() as tmp:
        for name, text in texts.items():
            f = Path(tmp) / f"{name}.txt"
            f.write_bytes(text.encode("utf-8"))      # bytes: keep \r\n as written
            title, subtitle, rows = j.read_chart(f)
            charts[name] = {"text": text, "title": title, "subtitle": subtitle, "rows": [list(r) for r in rows]}
    return {
        "parts": {pid: {"clef": c, "trans": t} for pid, (c, t) in PARTS.items()},
        "from_starts": FROM_STARTS,
        "starts": {clef: {s: start_for(clef, s) for s in START_TEXTS} for clef in j.CLEF_START},
        "scales": {pid: {t: scale_case(part, t) for t in SCALE_TEXTS} for pid, part in parts.items()},
        "chords": chords,
        "options": {c: {"options": maybe(j.scale_options, c), "default": maybe(j.default_scale, c)}
                    for c in CHORDS},
        "charts": charts,
    }


def render():
    return json.dumps(build(), ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    FIXTURE.parent.mkdir(exist_ok=True)
    FIXTURE.write_text(render(), encoding="utf-8")
    print(f"wrote {FIXTURE.relative_to(ROOT)}")
```

- [ ] **Step 4: Generate and verify**

Run: `.venv/bin/python tools/export_fixtures.py && .venv/bin/python -m pytest -q tests`
Expected: `wrote fixtures/golden.json`, then `12 passed`. The file is about 1 MB.

- [ ] **Step 5: Commit**

```bash
git add tools/export_fixtures.py tests/test_fixtures.py fixtures/golden.json
git commit -m "test: export golden fixtures from the Python engine"
```

---

### Task 4: TS package scaffold

**Files:** Create: `web/package.json`, `web/tsconfig.json`, `web/vitest.config.ts`

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "jazz-scales-web",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install exact dev dependencies** (`-E` pins exact versions; TypeScript stays on 5.x because Nuxt in phase 2 expects it)

```bash
cd web && npm install -D -E typescript@5 vitest @types/node
```

Expected: `devDependencies` gains `typescript 5.9.x`, `vitest 5.x`, `@types/node`; `package-lock.json` created.

- [ ] **Step 3: Create `web/tsconfig.json`**

`web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["engine/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `web/vitest.config.ts`**

`web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['engine/**/*.test.ts'] },
})
```

- [ ] **Step 5: Verify the toolchain runs**

Run: `cd web && npx vitest run --passWithNoTests && npx tsc --noEmit`
Expected: vitest reports no test files and exits 0; `tsc` exits 0 (it only checks `vitest.config.ts` so far).

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/tsconfig.json web/vitest.config.ts
git commit -m "chore(web): TypeScript + vitest package for the engine"
```

---

### Task 5: `pitch.ts`

**Files:** Create: `web/engine/pitch.ts`, Test: `web/engine/__tests__/pitch.test.ts`

Ports `LETTERS`, `NAT_PC`, `parse_root`, `root_name`, `pc_of`, `acc_for`, `enharmonics`.

- [ ] **Step 1: Write the failing test**

`web/engine/__tests__/pitch.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { accFor, enharmonics, mod, parseRoot, pcOf, rootName } from '../pitch'

describe('pitch', () => {
  it('mod is always positive', () => {
    expect(mod(-1, 12)).toBe(11)
    expect(mod(13, 12)).toBe(1)
  })

  it('parses note names with ascii and unicode accidentals', () => {
    expect(parseRoot('Bb')).toEqual({ letter: 6, acc: -1 })
    expect(parseRoot('f#')).toEqual({ letter: 3, acc: 1 })
    expect(parseRoot('E♭♭')).toEqual({ letter: 2, acc: -2 })
    expect(() => parseRoot('H')).toThrow(/bad note name/)
  })

  it('names, pitch classes and accidentals', () => {
    expect(rootName({ letter: 1, acc: -1 })).toBe('Db')
    expect(pcOf({ letter: 0, acc: -1 })).toBe(11) // Cb
    expect(accFor(6, 3)).toBe(1) // pc 6 on F = F#
    expect(accFor(6, 4)).toBe(-1) // pc 6 on G = Gb
  })

  it('lists single-accidental enharmonics in letter order', () => {
    expect(enharmonics(parseRoot('F#')).map(rootName)).toEqual(['F#', 'Gb'])
    expect(enharmonics(parseRoot('F')).map(rootName)).toEqual(['E#', 'F'])
    expect(enharmonics(parseRoot('D')).map(rootName)).toEqual(['D'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/pitch.test.ts`
Expected: FAIL, the module `../pitch` cannot be resolved

- [ ] **Step 3: Implement**

`web/engine/pitch.ts`:

```ts
export type Letter = 0 | 1 | 2 | 3 | 4 | 5 | 6 // C D E F G A B
export type Spelled = Readonly<{ letter: Letter; acc: number }>

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export const NAT_PC = [0, 2, 4, 5, 7, 9, 11] as const

/** always-positive modulo (JS % keeps the sign of the dividend) */
export const mod = (n: number, m: number): number => ((n % m) + m) % m
export const toLetter = (n: number): Letter => mod(n, 7) as Letter

export function parseRoot(tok: string): Spelled {
  const m = /^([A-Ga-g])([b#♭♯]*)$/.exec(tok)
  if (!m) throw new Error(`bad note name: ${JSON.stringify(tok)}`)
  const acc = [...m[2]].reduce((s, c) => s + (c === '#' || c === '♯' ? 1 : -1), 0)
  return { letter: 'CDEFGAB'.indexOf(m[1].toUpperCase()) as Letter, acc }
}

export const accText = (acc: number): string => (acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc))
export const rootName = (n: Spelled): string => LETTERS[n.letter] + accText(n.acc)
export const pcOf = (n: Spelled): number => mod(NAT_PC[n.letter] + n.acc, 12)
export const accFor = (pc: number, letter: Letter): number => mod(pc - NAT_PC[letter] + 6, 12) - 6

/** all spellings of this pitch class with at most one accidental, in letter order */
export function enharmonics(n: Spelled): Spelled[] {
  const pc = pcOf(n)
  return LETTERS.map((_, l) => ({ letter: l as Letter, acc: accFor(pc, l as Letter) })).filter(
    (s) => Math.abs(s.acc) <= 1,
  )
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd web && npx vitest run engine/__tests__/pitch.test.ts && npx tsc --noEmit`
Expected: `4 passed`, no type errors

- [ ] **Step 5: Commit**

```bash
git add web/engine/pitch.ts web/engine/__tests__/pitch.test.ts
git commit -m "feat(engine): pitch primitives"
```

---

### Task 6: `scales.ts`

**Files:** Create: `web/engine/scales.ts`, Test: `web/engine/__tests__/scales.test.ts`

Ports `SCALES`, `ALIASES`, `norm`, `spell_from`, `simplify_root`, `parse_scale`, `spell_scale`. `SCALES` and `ALIASES` are copied verbatim from `jazz_scales.py`; the golden test catches any typo. `simplifyRoot` lives here, not in `pitch.ts`, because it needs `spellFrom` and `SCALES`. Tie-breaking must match Python's `min()`: the first minimal option in `enharmonics()` order.

- [ ] **Step 1: Write the failing test**

`web/engine/__tests__/scales.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseRoot, rootName } from '../pitch'
import { parseScale, scaleKey, simplifyRoot, spellFrom, spellScale } from '../scales'

const spelled = (text: string): string => {
  const { root, key } = parseScale(text)
  return spellScale(root, key).map(rootName).join(' ')
}

describe('scales', () => {
  it('spells scales from their formulas', () => {
    expect(spelled('C Dorian')).toBe('C D Eb F G A Bb')
    expect(spelled('D Half-Whole')).toBe('D Eb F F# G# A B C')
    expect(spelled('G Altered')).toBe('G Ab Bb B C# Eb F')
  })

  it('normalises names and resolves aliases', () => {
    expect(scaleKey('Half Whole Dim')).toBe('half whole diminished')
    expect(scaleKey('major')).toBe('ionian')
    expect(scaleKey('Locrian ♮2')).toBe('locrian natural 2')
    expect(parseScale('  Bb   dorian ')).toEqual({ root: { letter: 6, acc: -1 }, key: 'dorian' })
  })

  it('rejects unknown scales and missing names', () => {
    expect(() => parseScale('C Dorain')).toThrow(/unknown scale/)
    expect(() => parseScale('C constructor')).toThrow(/unknown scale/)
    expect(() => parseScale('C')).toThrow(/root and a name/)
    expect(spellFrom(parseRoot('C'), '0')).toEqual([{ letter: 6, acc: 0, semis: 11 }]) // degree 0 wraps like Python
  })

  it('simplifies roots by looking at the whole scale', () => {
    expect(rootName(simplifyRoot(parseRoot('Db'), 'dorian'))).toBe('C#') // Db Dorian needs Fb, Cb
    expect(rootName(simplifyRoot(parseRoot('D#'), 'dorian'))).toBe('Eb')
    expect(rootName(simplifyRoot(parseRoot('Gb')))).toBe('Gb') // tie keeps flat direction
    expect(rootName(simplifyRoot(parseRoot('E'), 'ionian'))).toBe('E')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/scales.test.ts`
Expected: FAIL, the module `../scales` cannot be resolved

- [ ] **Step 3: Implement**

`web/engine/scales.ts`:

```ts
import { type Spelled, accFor, enharmonics, mod, NAT_PC, parseRoot, pcOf, rootName, toLetter } from './pitch'

/** name: [degree formula, label printed on the page]; copied verbatim from jazz_scales.py */
export const SCALES = {
  ionian: ['1 2 3 4 5 6 7', 'Ionian'],
  dorian: ['1 2 b3 4 5 6 b7', 'Dorian'],
  phrygian: ['1 b2 b3 4 5 b6 b7', 'Phrygian'],
  lydian: ['1 2 3 #4 5 6 7', 'Lydian'],
  mixolydian: ['1 2 3 4 5 6 b7', 'Mixolydian'],
  aeolian: ['1 2 b3 4 5 b6 b7', 'Aeolian'],
  locrian: ['1 b2 b3 4 b5 b6 b7', 'Locrian'],
  'locrian natural 2': ['1 2 b3 4 b5 b6 b7', 'Locrian ♮2'],
  'melodic minor': ['1 2 b3 4 5 6 7', 'Melodic Minor'],
  'harmonic minor': ['1 2 b3 4 5 b6 7', 'Harmonic Minor'],
  'lydian dominant': ['1 2 3 #4 5 6 b7', 'Lydian Dominant'],
  'lydian augmented': ['1 2 3 #4 #5 6 7', 'Lydian Augmented'],
  altered: ['1 b2 b3 3 #4 b6 b7', 'Altered'],
  'phrygian dominant': ['1 b2 3 4 5 b6 b7', 'Phrygian Dominant'],
  'half whole diminished': ['1 b2 b3 3 #4 5 6 b7', 'Half-Whole Dim.'],
  'whole half diminished': ['1 2 b3 4 b5 b6 6 7', 'Whole-Half Dim.'],
  'whole tone': ['1 2 3 #4 #5 b7', 'Whole Tone'],
  'major pentatonic': ['1 2 3 5 6', 'Major Pentatonic'],
  'minor pentatonic': ['1 b3 4 5 b7', 'Minor Pentatonic'],
  blues: ['1 b3 4 b5 5 b7', 'Blues'],
  'bebop dominant': ['1 2 3 4 5 6 b7 7', 'Bebop Dominant'],
  'bebop major': ['1 2 3 4 5 b6 6 7', 'Bebop Major'],
  'bebop dorian': ['1 2 b3 3 4 5 6 b7', 'Bebop Dorian'],
} as const satisfies Record<string, readonly [string, string]>

export type ScaleKey = keyof typeof SCALES

export const ALIASES: Readonly<Record<string, ScaleKey>> = {
  major: 'ionian',
  minor: 'aeolian',
  'natural minor': 'aeolian',
  'locrian 2': 'locrian natural 2',
  'locrian #2': 'locrian natural 2',
  'lydian b7': 'lydian dominant',
  'lydian #5': 'lydian augmented',
  'super locrian': 'altered',
  'diminished whole half': 'whole half diminished',
  'half whole': 'half whole diminished',
  hw: 'half whole diminished',
  'half whole dim': 'half whole diminished',
  'dominant diminished': 'half whole diminished',
  'whole half': 'whole half diminished',
  wh: 'whole half diminished',
  'whole half dim': 'whole half diminished',
  diminished: 'whole half diminished',
  'mixolydian b6': 'phrygian dominant',
  bebop: 'bebop dominant',
}

export type ScaleNote = Readonly<Spelled & { semis: number }>
export type ParsedScale = Readonly<{ root: Spelled; key: ScaleKey }>

export const norm = (s: string): string =>
  s
    .toLowerCase()
    .replaceAll('-', ' ')
    .replaceAll('♮', 'natural ')
    .replaceAll('.', '')
    .replace(/\s+/g, ' ')
    .trim()

const count = (s: string, c: string): number => s.split(c).length - 1

/** scale formula on a root -> spelled notes with semitones above the root */
export function spellFrom(root: Spelled, formula: string): ScaleNote[] {
  const rootPc = pcOf(root)
  return formula
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const m = /^([b#]*)(\d+)$/.exec(tok)
      if (!m) throw new Error(`bad scale degree: ${JSON.stringify(tok)}`)
      const idx = mod(Number(m[2]) - 1, 7)
      const semis = NAT_PC[idx] + count(m[1], '#') - count(m[1], 'b')
      const letter = toLetter(root.letter + idx)
      return { letter, acc: accFor(mod(rootPc + semis, 12), letter), semis }
    })
}

const isUgly = (n: Spelled): boolean =>
  Math.abs(n.acc) > 1 ||
  (n.acc === 1 && (n.letter === 6 || n.letter === 2)) || // B#, E#
  (n.acc === -1 && (n.letter === 0 || n.letter === 3)) // Cb, Fb

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

/** first element with the smallest key (lexicographic), like Python's min() */
function minBy<T>(xs: readonly T[], key: (x: T) => readonly number[]): T {
  return xs.slice(1).reduce((best, x) => (lexLess(key(x), key(best)) ? x : best), xs[0])
}

/**
 * friendliest spelling of a root, judged over the whole scale: no B#/E#/Cb/Fb or
 * double accidentals if avoidable, then fewest accidentals; ties keep the original
 * direction, else flats (but F# over Gb)
 */
export function simplifyRoot(n: Spelled, key: ScaleKey = 'ionian'): Spelled {
  const formula = SCALES[key][0]
  const cost = (o: Spelled): readonly number[] => {
    const notes = spellFrom(o, formula)
    const ugly = notes.filter(isUgly).length
    const total = notes.reduce((s, x) => s + Math.abs(x.acc), 0)
    const sameDir = o.acc === n.acc || (n.acc === 0 && (o.acc <= 0 || pcOf(o) === 6)) ? 0 : 1
    return [ugly, total, sameDir]
  }
  return minBy(enharmonics(n), cost)
}

const isScaleKey = (k: string): k is ScaleKey => Object.hasOwn(SCALES, k)

/** scale name ("Half-Whole Dim.", "hw", "Locrian ♮2") -> SCALES key */
export function scaleKey(name: string): ScaleKey {
  const k = norm(name)
  const key = Object.hasOwn(ALIASES, k) ? ALIASES[k] : k
  if (!isScaleKey(key)) throw new Error(`unknown scale ${JSON.stringify(name.trim())}`)
  return key
}

/** "Bb Dorian" -> root + key */
export function parseScale(text: string): ParsedScale {
  const t = text.trim()
  const i = t.search(/\s/)
  if (i < 0) throw new Error(`scale needs a root and a name: ${JSON.stringify(text)}`)
  return { root: parseRoot(t.slice(0, i)), key: scaleKey(t.slice(i)) }
}

export function spellScale(root: Spelled, key: ScaleKey): ScaleNote[] {
  const notes = spellFrom(root, SCALES[key][0])
  if (notes.some((n) => Math.abs(n.acc) > 2))
    throw new Error(`${rootName(root)} ${key} needs a triple accidental; pick an enharmonic root`)
  if (notes.some((n, i) => i > 0 && n.semis <= notes[i - 1].semis))
    throw new Error(`scale formula not ascending: ${key}`)
  return notes
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd web && npx vitest run engine/__tests__/scales.test.ts && npx tsc --noEmit`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add web/engine/scales.ts web/engine/__tests__/scales.test.ts
git commit -m "feat(engine): scale formulas, spelling and enharmonic choice"
```

---

### Task 7: `instruments.ts` + `part.ts`

**Files:** Create: `web/engine/instruments.ts`, `web/engine/part.ts`, Test: `web/engine/__tests__/part.test.ts`

Ports `TRANSPOSITIONS`, `INSTRUMENTS`, `CLEF_START`, `CLEF_ROOT_LOW`, `transpose_root`, the `Part` class (as a value type plus functions), `lily_note` and `parse_start`. `resolveStart` is the start-pitch logic from Python's `main()`. Tests port `tests/test_jazz_scales.py`.

- [ ] **Step 1: Write the failing test**

`web/engine/__tests__/part.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { type Mode, type Part, CONCERT, lilyNote, resolveStart, scaleLabel, scaleNotes, writtenScale } from '../part'
import { rootName } from '../pitch'

const BB: Part = { clef: 'treble', trans: 'Bb' }
const EB: Part = { clef: 'treble', trans: 'Eb' }
const BASS: Part = { clef: 'bass', trans: 'C' }

const notes = (part: Part, scale: string, mode: Mode = 'root', start = 60): string =>
  scaleNotes(part, scale, mode, start).map(lilyNote).join(' ')
const root = (part: Part, scale: string): string => rootName(writtenScale(part, scale).root)

describe('part', () => {
  it('spells scales from the root in the clef range', () => {
    expect(notes(CONCERT, 'C Dorian')).toBe("c' d' ees' f' g' a' bes'")
    expect(notes(CONCERT, 'Bb Dorian')).toBe("bes c' des' ees' f' g' aes'")
    expect(notes(CONCERT, 'A Locrian')).toBe("a' bes' c'' d'' ees'' f'' g''")
    expect(notes(CONCERT, 'F Altered')).toBe("f' ges' aes' a' b' des'' ees''")
    expect(notes(BASS, 'C Dorian')).toBe('c d ees f g a bes')
  })

  it('spells scales from a fixed note', () => {
    expect(notes(CONCERT, 'F Mixolydian', 'from')).toBe("c' d' ees' f' g' a' bes'")
    expect(notes(CONCERT, 'B Dorian', 'from')).toBe("cis' d' e' fis' gis' a' b'")
    expect(notes(CONCERT, 'G Half-Whole', 'from', 63)).toBe("e' f' g' aes' bes' b' cis'' d''")
  })

  it('transposes roots with friendly spellings', () => {
    expect(root(BB, 'C Dorian')).toBe('D')
    expect(root(BB, 'B Dorian')).toBe('C#')
    expect(root(BB, 'E Mixolydian')).toBe('F#')
    expect(root(BB, 'C# Dorian')).toBe('Eb')
    expect(root(EB, 'C Dorian')).toBe('A')
    expect(root(EB, 'Eb Lydian')).toBe('C')
    expect(root(EB, 'Bb Dorian')).toBe('G')
  })

  it('labels scales with the written root', () => {
    expect(scaleLabel(BB, 'Bb Half-Whole')).toEqual({ root: { letter: 0, acc: 0 }, name: 'Half-Whole Dim.' })
  })

  it('resolves written start notes', () => {
    expect(resolveStart('treble', 'C')).toBe(60)
    expect(resolveStart('treble', 'Eb')).toBe(63)
    expect(resolveStart('treble', 'F#3')).toBe(54)
    expect(resolveStart('treble', 'Cb')).toBe(71)
    expect(resolveStart('bass', 'G')).toBe(55)
    expect(() => resolveStart('treble', 'X')).toThrow(/bad start note/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/part.test.ts`
Expected: FAIL, the module `../part` cannot be resolved

- [ ] **Step 3: Implement `instruments.ts`**

`web/engine/instruments.ts`:

```ts
export type Transposition = 'C' | 'Bb' | 'Eb' | 'F'
export type Clef = 'treble' | 'bass'
export type Instrument = Readonly<{ clef: Clef; trans: Transposition; description: string }>

/** written = concert + interval: [letter steps, semitones] up from concert */
export const TRANSPOSITIONS: Readonly<Record<Transposition, readonly [number, number]>> = {
  C: [0, 0],
  Bb: [1, 2],
  Eb: [5, 9],
  F: [4, 7],
}

/** octave transpositions (guitar, bass, tenor, bari) don't matter: scales sit in a fixed written range */
export const INSTRUMENTS = {
  concert: { clef: 'treble', trans: 'C', description: 'any C instrument, treble clef (piano RH, vibes, flute, violin)' },
  piano: { clef: 'treble', trans: 'C', description: 'same as concert' },
  vibes: { clef: 'treble', trans: 'C', description: 'same as concert' },
  flute: { clef: 'treble', trans: 'C', description: 'same as concert' },
  guitar: { clef: 'treble', trans: 'C', description: 'same as concert' },
  trumpet: { clef: 'treble', trans: 'Bb', description: 'Bb, written a major 2nd up' },
  flugelhorn: { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  clarinet: { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  'soprano-sax': { clef: 'treble', trans: 'Bb', description: 'same as trumpet' },
  'tenor-sax': { clef: 'treble', trans: 'Bb', description: 'same key as trumpet (sounds an octave lower)' },
  'alto-sax': { clef: 'treble', trans: 'Eb', description: 'Eb, written a major 6th up' },
  'bari-sax': { clef: 'treble', trans: 'Eb', description: 'same key as alto (sounds an octave lower)' },
  horn: { clef: 'treble', trans: 'F', description: 'French horn in F, written a perfect 5th up' },
  trombone: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
  tuba: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
  bass: { clef: 'bass', trans: 'C', description: 'bass clef, concert pitch' },
} as const satisfies Record<string, Instrument>

export type InstrumentName = keyof typeof INSTRUMENTS

/** default 'from' pitch: C4 / C3 (MIDI, middle C = 60) */
export const CLEF_START: Readonly<Record<Clef, number>> = { treble: 60, bass: 48 }
/** root-spelled scales start in Bb3..A4 / G2..F#3 */
export const CLEF_ROOT_LOW: Readonly<Record<Clef, number>> = { treble: 58, bass: 43 }
```

- [ ] **Step 4: Implement `part.ts`**

`web/engine/part.ts`:

```ts
import { type Clef, type Transposition, CLEF_ROOT_LOW, CLEF_START, TRANSPOSITIONS } from './instruments'
import { type Spelled, accFor, LETTERS, mod, NAT_PC, parseRoot, pcOf, toLetter } from './pitch'
import { type ScaleKey, type ScaleNote, parseScale, SCALES, simplifyRoot, spellScale } from './scales'

/** an instrument "view" of the chart */
export type Part = Readonly<{ clef: Clef; trans: Transposition }>
export type Mode = 'from' | 'root'
export type Pitched = Readonly<Spelled & { midi: number }>
export type WrittenScale = Readonly<{ root: Spelled; key: ScaleKey; notes: readonly ScaleNote[] }>
export type ScaleLabel = Readonly<{ root: Spelled; name: string }>

export const CONCERT: Part = { clef: 'treble', trans: 'C' }

/** move a spelled note up by the transposition interval */
export function transposeRoot(n: Spelled, trans: Transposition): Spelled {
  const [steps, semis] = TRANSPOSITIONS[trans]
  const letter = toLetter(n.letter + steps)
  return { letter, acc: accFor(mod(pcOf(n) + semis, 12), letter) }
}

export const writtenRoot = (part: Part, n: Spelled, key?: ScaleKey): Spelled =>
  part.trans === 'C' ? n : simplifyRoot(transposeRoot(n, part.trans), key)

/** concert scale text -> written root, key and spelled notes */
export function writtenScale(part: Part, text: string): WrittenScale {
  const { root, key } = parseScale(text)
  const written = writtenRoot(part, root, key)
  return { root: written, key, notes: spellScale(written, key) }
}

export function scaleNotes(part: Part, text: string, mode: Mode, start: number): Pitched[] {
  const { root, notes } = writtenScale(part, text)
  const rootPc = pcOf(root)
  if (mode === 'root') {
    const low = CLEF_ROOT_LOW[part.clef]
    const p0 = low + mod(rootPc - low, 12)
    return notes.map((n) => ({ letter: n.letter, acc: n.acc, midi: p0 + n.semis }))
  }
  // every note in the octave beginning at the start pitch
  return notes
    .map((n) => ({ letter: n.letter, acc: n.acc, midi: start + mod(rootPc + n.semis - start, 12) }))
    .sort((a, b) => a.midi - b.midi)
}

export function scaleLabel(part: Part, text: string): ScaleLabel {
  const { root, key } = writtenScale(part, text)
  return { root, name: SCALES[key][1] }
}

/** LilyPond note name, e.g. ees' (used for parity with jazz_scales.py) */
export function lilyNote(n: Pitched): string {
  const d = n.midi - NAT_PC[n.letter] - n.acc
  if (mod(d, 12) !== 0) throw new Error(`pitch ${n.midi} does not match its spelling`)
  const marks = Math.floor(d / 12) - 4 // written octave, C4 = 60; c = octave 3
  const name = LETTERS[n.letter].toLowerCase() + (n.acc > 0 ? 'is'.repeat(n.acc) : 'es'.repeat(-n.acc))
  return name + (marks >= 0 ? "'".repeat(marks) : ','.repeat(-marks))
}

/** 'C' -> { exact: null, pc: 0 }; 'F#3' -> { exact: 54, pc: 6 } (middle C = C4) */
export function parseStart(text: string): Readonly<{ exact: number | null; pc: number }> {
  const m = /^([A-Ga-g][b#♭♯]*)(\d)?$/.exec(text.trim())
  if (!m) throw new Error(`bad start note ${JSON.stringify(text)} (try C, Eb, F#3)`)
  const r = parseRoot(m[1])
  const pc = NAT_PC[r.letter] + r.acc
  return { exact: m[2] === undefined ? null : 12 * (Number(m[2]) + 1) + pc, pc }
}

/** written start pitch: exact octave if given, else the first one at/above the clef's default */
export function resolveStart(clef: Clef, text: string): number {
  const { exact, pc } = parseStart(text)
  const base = CLEF_START[clef]
  return exact ?? base + mod(pc - base, 12)
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd web && npx vitest run engine/__tests__/part.test.ts && npx tsc --noEmit`
Expected: `5 passed`

- [ ] **Step 6: Commit**

```bash
git add web/engine/instruments.ts web/engine/part.ts web/engine/__tests__/part.test.ts
git commit -m "feat(engine): instruments, transposition and scale notes"
```

---

### Task 8: `chord.ts`

**Files:** Create: `web/engine/chord.ts`, Test: `web/engine/__tests__/chord.test.ts`

Ports `Part.chord_markup` as `chordTokens`. Its output is tokens instead of LilyPond markup; phase 2's `ChordSymbol.vue` renders them.

- [ ] **Step 1: Write the failing test**

`web/engine/__tests__/chord.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { type ChordToken, chordTokens, parseChord } from '../chord'
import { type Part, CONCERT } from '../part'

const BB: Part = { clef: 'treble', trans: 'Bb' }
/** compact view: accidentals as ♭/♯ */
const show = (tokens: readonly ChordToken[]): string =>
  tokens.map((t) => (t.kind === 'text' ? t.text : t.acc === 'b' ? '♭' : '♯')).join('')

describe('chord', () => {
  it('splits root, quality and bass', () => {
    expect(parseChord('D7/F#')).toEqual({ root: { letter: 1, acc: 0 }, quality: '7', bass: { letter: 3, acc: 1 } })
    expect(parseChord('C6/9')).toEqual({ root: { letter: 0, acc: 0 }, quality: '6/9' })
    expect(parseChord('C6/9/E').quality).toBe('6/9')
    expect(() => parseChord('X7')).toThrow(/cannot parse chord/)
  })

  it('formats minor, major and alterations', () => {
    expect(chordTokens(CONCERT, 'Cm7')).toEqual([{ kind: 'text', text: 'C–7' }])
    expect(show(chordTokens(CONCERT, 'Am7b5'))).toBe('A–7(♭5)')
    expect(show(chordTokens(CONCERT, 'G7#9b13'))).toBe('G7(♯9,♭13)')
    expect(show(chordTokens(CONCERT, 'Cmaj7'))).toBe('CMaj7')
    expect(show(chordTokens(CONCERT, 'Db7(b9)'))).toBe('D♭7(♭9)')
  })

  it('transposes root and bass, following the scale spelling', () => {
    expect(show(chordTokens(BB, 'D7/F#', 'D Half-Whole'))).toBe('E7/G♯')
    expect(show(chordTokens(BB, 'Bm7', 'B Dorian'))).toBe('C♯–7')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/chord.test.ts`
Expected: FAIL, the module `../chord` cannot be resolved

- [ ] **Step 3: Implement**

`web/engine/chord.ts`:

```ts
import { type Part, writtenRoot } from './part'
import { type Spelled, accFor, LETTERS, mod, parseRoot, pcOf, toLetter } from './pitch'
import { parseScale, simplifyRoot } from './scales'

/** root, quality (everything between root and /bass), optional bass; same regex as jazz_scales.py */
export const CHORD_RE = /^([A-G])([b#♭♯]?)(.*?)(?:\/([A-G])([b#♭♯]?))?$/

export type ChordParts = Readonly<{ root: Spelled; quality: string; bass?: Spelled }>
export type ChordToken = Readonly<{ kind: 'text'; text: string } | { kind: 'acc'; acc: 'b' | '#' }>

export function parseChord(text: string): ChordParts {
  const m = CHORD_RE.exec(text.trim())
  if (!m) throw new Error(`cannot parse chord ${JSON.stringify(text)}`)
  const root = parseRoot(m[1] + m[2])
  return m[4] === undefined
    ? { root, quality: m[3] }
    : { root, quality: m[3], bass: parseRoot(m[4] + (m[5] ?? '')) }
}

const text = (t: string): ChordToken => ({ kind: 'text', text: t })
const accTokens = (acc: number): ChordToken[] =>
  Array.from({ length: Math.abs(acc) }, () => ({ kind: 'acc', acc: acc > 0 ? '#' : 'b' }) as const)

/** "m7b5" -> "–7(", ♭, "5)": minor as en dash, alterations in parentheses */
function qualityTokens(quality: string): ChordToken[] {
  const rest = quality
    .replace(/[()]/g, '')
    .replace(/^(?:min|mi|m(?!a))/, '–')
    .replace(/^-/, '–')
    .replace(/^ma(?:j)?/, 'Maj')
  const out: ChordToken[] = []
  let pos = 0
  for (const run of rest.matchAll(/(?:[b#]\d+)+/g)) {
    const start = run.index
    if (start > pos) out.push(text(rest.slice(pos, start)))
    out.push(text('('))
    const alts = [...run[0].matchAll(/([b#])(\d+)/g)]
    alts.forEach((a, i) => {
      out.push({ kind: 'acc', acc: a[1] === 'b' ? 'b' : '#' })
      out.push(text(a[2] + (i < alts.length - 1 ? ',' : '')))
    })
    out.push(text(')'))
    pos = start + run[0].length
  }
  if (pos < rest.length) out.push(text(rest.slice(pos)))
  return out
}

const mergeText = (tokens: readonly ChordToken[]): ChordToken[] =>
  tokens.reduce<ChordToken[]>((out, t) => {
    const last = out[out.length - 1]
    return t.kind === 'text' && last?.kind === 'text'
      ? [...out.slice(0, -1), text(last.text + t.text)]
      : [...out, t]
  }, [])

/**
 * written chord symbol as display tokens. The root follows the scale's spelling when
 * they share a pitch; a slash bass keeps its interval from the root (D7/F# -> E7/G# on Bb).
 */
export function chordTokens(part: Part, chord: string, scaleText?: string): ChordToken[] {
  const c = parseChord(chord)
  const s = scaleText ? parseScale(scaleText) : undefined
  const root = s && pcOf(s.root) === pcOf(c.root) ? writtenRoot(part, s.root, s.key) : writtenRoot(part, c.root)
  const tokens = [text(LETTERS[root.letter]), ...accTokens(root.acc), ...qualityTokens(c.quality)]
  if (c.bass) {
    const letter = toLetter(root.letter + (c.bass.letter - c.root.letter))
    const acc = accFor(mod(pcOf(root) + (pcOf(c.bass) - pcOf(c.root)), 12), letter)
    const bass = Math.abs(acc) > 1 ? simplifyRoot({ letter, acc }) : { letter, acc }
    tokens.push(text('/' + LETTERS[bass.letter]), ...accTokens(bass.acc))
  }
  return mergeText(tokens)
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd web && npx vitest run engine/__tests__/chord.test.ts && npx tsc --noEmit`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add web/engine/chord.ts web/engine/__tests__/chord.test.ts
git commit -m "feat(engine): chord symbol parsing and display tokens"
```

---

### Task 9: `qualities.ts`

**Files:** Create: `web/engine/qualities.ts`, Test: `web/engine/__tests__/qualities.test.ts`

Same lookup as Task 1, with one difference: an unknown quality returns `null` instead of raising, so the UI can prompt for a scale. `chord_scales.json` is imported from the repo root (`../../chord_scales.json`).

- [ ] **Step 1: Write the failing test**

`web/engine/__tests__/qualities.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { defaultScale, QUALITY_NAMES, resolveQuality } from '../qualities'
import { parseScale } from '../scales'

describe('qualities', () => {
  it('picks the default scale for a chord quality', () => {
    expect(defaultScale('Cm7')).toBe('C Dorian')
    expect(defaultScale('F7')).toBe('F Mixolydian')
    expect(defaultScale('Gm')).toBe('G Dorian')
    expect(defaultScale('C')).toBe('C Ionian')
    expect(defaultScale('C6/9')).toBe('C Ionian')
    expect(defaultScale('D7/F#')).toBe('D Mixolydian')
    expect(defaultScale('Am7b5')).toBe('A Locrian')
  })

  it('returns null for unknown qualities so the UI can prompt', () => {
    expect(resolveQuality('Cm7#5#9x')).toBeNull()
    expect(defaultScale('Cm7#5#9x')).toBeNull()
  })

  it('spells alternate roots from the interval', () => {
    const scales = resolveQuality('Cm7')?.options.map((o) => o.scale)
    expect(scales).toContain('Eb Major Pentatonic')
    expect(resolveQuality('Gbm7b5')?.options.map((o) => o.scale)).toContain('D Major Pentatonic')
    expect(resolveQuality('Bb7alt')?.options.map((o) => o.scale)).toContain('B Melodic Minor')
  })

  it('every quality has exactly one default and known scales', () => {
    for (const q of QUALITY_NAMES) {
      const options = resolveQuality(`C${q}`)?.options ?? []
      expect(options.filter((o) => o.default), q).toHaveLength(1)
      for (const o of options) expect(() => parseScale(o.scale)).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/qualities.test.ts`
Expected: FAIL, the module `../qualities` cannot be resolved

- [ ] **Step 3: Implement**

`web/engine/qualities.ts`:

```ts
import raw from '../../chord_scales.json'
import { parseChord } from './chord'
import { type Spelled, rootName } from './pitch'
import { scaleKey, simplifyRoot, spellFrom } from './scales'

type RawOption = Readonly<{ root: string; scale: string; default?: boolean; note?: string }>
type QualityData = Readonly<{
  quality_aliases: Readonly<Record<string, readonly string[]>>
  qualities: Readonly<Record<string, readonly RawOption[]>>
}>

const DATA: QualityData = raw

/** chord-symbol quality text ("-7", "m7", "min7") -> canonical quality ("m7") */
const LOOKUP: ReadonlyMap<string, string> = new Map([
  ...Object.keys(DATA.qualities).map((q) => [q, q] as const),
  ...Object.entries(DATA.quality_aliases).flatMap(([q, names]) => names.map((n) => [n, q] as const)),
])

export type ScaleOption = Readonly<{ scale: string; note: string; default: boolean }>
export type QualityMatch = Readonly<{ quality: string; options: readonly ScaleOption[] }>

/** scale options for a chord, roots spelled from the chord root; null if the quality is unknown */
export function resolveQuality(chord: string): QualityMatch | null {
  const c = parseChord(chord)
  const quality = LOOKUP.get(c.quality)
  if (quality === undefined) return null
  const options = (DATA.qualities[quality] ?? []).map((opt): ScaleOption => {
    const key = scaleKey(opt.scale)
    const r: Spelled = spellFrom(c.root, opt.root)[0]
    const root = opt.root === '1' ? r : simplifyRoot(r, key) // interval-derived: friendliest spelling
    return { scale: `${rootName(root)} ${opt.scale}`, note: opt.note ?? '', default: opt.default ?? false }
  })
  return { quality, options }
}

/** the quality's default scale ("Cm7" -> "C Dorian"); null if the quality is unknown */
export function defaultScale(chord: string): string | null {
  const options = resolveQuality(chord)?.options ?? []
  return (options.find((o) => o.default) ?? options[0])?.scale ?? null
}

/** every quality's options, for validating chord_scales.json */
export const QUALITY_NAMES: readonly string[] = Object.keys(DATA.qualities)
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd web && npx vitest run engine/__tests__/qualities.test.ts && npx tsc --noEmit`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add web/engine/qualities.ts web/engine/__tests__/qualities.test.ts
git commit -m "feat(engine): chord quality defaults and alternates"
```

---

### Task 10: `limits.ts` + `chart.ts`

**Files:** Create: `web/engine/limits.ts`, `web/engine/chart.ts`, Test: `web/engine/__tests__/chart.test.ts`

This is the document model from design §4. Unlike Python's `read_chart`, the parser is tolerant: a bad line becomes an `invalid` line, kept verbatim, plus a diagnostic, and nothing throws. That's what lets the text editor show errors inline. Security (design §9): the length cap is checked before any parsing, and `@copy` expansion is capped *before* rows are added, because `A | 1 | C` followed by 1,000 `@copy A A 1` lines would otherwise double the row count on every line.

- [ ] **Step 1: Write the failing test**

`web/engine/__tests__/chart.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { chartMeta, expandRows, parseChart, resolveScale, serializeChart } from '../chart'
import { LIMITS } from '../limits'

const SAMPLE = `title: T
subtitle: S

# section | bar | chord | scale
A | 1 | Cm7 | C Dorian
A | 2 | F7
@copy A B 8
`

describe('chart', () => {
  it('parses meta, rows, copies, comments and blanks', () => {
    const { value: doc, diagnostics } = parseChart(SAMPLE)
    expect(diagnostics).toEqual([])
    expect(doc.lines.map((l) => l.kind)).toEqual(['meta', 'meta', 'blank', 'comment', 'row', 'row', 'copy'])
    expect(chartMeta(doc)).toEqual({ title: 'T', subtitle: 'S' })
    expect(doc.lines[5]).toEqual({ kind: 'row', section: 'A', bar: '2', chord: 'F7', scale: '' })
  })

  it('defaults the title', () => {
    expect(chartMeta(parseChart('A | 1 | C').value).title).toBe('Untitled')
  })

  it('expands @copy with bar offsets', () => {
    const rows = expandRows(parseChart(SAMPLE).value).value
    expect(rows.map((r) => `${r.section}${r.bar} ${r.chord}`)).toEqual(['A1 Cm7', 'A2 F7', 'B9 Cm7', 'B10 F7'])
  })

  it('resolves missing scales from the chord quality', () => {
    const rows = expandRows(parseChart(SAMPLE).value).value
    expect(rows.map(resolveScale)).toEqual(['C Dorian', 'F Mixolydian', 'C Dorian', 'F Mixolydian'])
    expect(resolveScale({ section: 'A', bar: '1', chord: 'Cm7#5#9x', scale: '' })).toBeNull()
    expect(resolveScale({ section: 'A', bar: '1', chord: 'X', scale: '' })).toBeNull()
  })

  it('reports bad lines without throwing and keeps them verbatim', () => {
    const { value: doc, diagnostics } = parseChart('A | 1\n@copy A\nA | 2 | C')
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2])
    expect(serializeChart(doc)).toBe('A | 1\n@copy A\nA | 2 | C\n')
  })

  it('serializes canonically and round-trips', () => {
    const doc = parseChart(SAMPLE).value
    const text = serializeChart(doc)
    expect(text).toContain('A | 1 | Cm7 | C Dorian\nA | 2 | F7\n')
    expect(parseChart(text).value).toEqual(doc)
    expect(serializeChart(parseChart(text).value)).toBe(text)
  })

  it('enforces input limits', () => {
    expect(parseChart('x'.repeat(LIMITS.maxChars + 1)).diagnostics[0].message).toMatch(/longer than/)
    expect(parseChart(`A | 1 | ${'C'.repeat(LIMITS.maxCell + 1)}`).diagnostics[0].message).toMatch(/cell longer/)
    const many = Array.from({ length: LIMITS.maxRows + 1 }, (_, i) => `A | ${i} | C`).join('\n')
    expect(parseChart(many).diagnostics.at(-1)?.message).toMatch(/more than 500 rows/)
  })

  it('caps expanded rows even without @copy', () => {
    const many = Array.from({ length: LIMITS.maxExpandedRows + 5 }, () => '|1|C').join('\n')
    const { value: rows, diagnostics } = expandRows(parseChart(many).value)
    expect(rows).toHaveLength(LIMITS.maxExpandedRows)
    expect(diagnostics.map((d) => d.line)).toEqual([LIMITS.maxExpandedRows + 1])
  })

  it('caps @copy section names and offsets', () => {
    const { diagnostics } = parseChart(`@copy A ${'B'.repeat(LIMITS.maxCell + 1)} 8\n@copy A B 12345\n@copy A B -8`)
    expect(diagnostics.map((d) => d.line)).toEqual([1, 2])
  })

  it('caps @copy expansion before it can grow exponentially', () => {
    const bomb = 'A | 1 | C\n' + '@copy A A 1\n'.repeat(1_000)
    const { value: rows, diagnostics } = expandRows(parseChart(bomb).value)
    expect(rows.length).toBeLessThanOrEqual(LIMITS.maxExpandedRows)
    expect(diagnostics).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/chart.test.ts`
Expected: FAIL, the module `../chart` cannot be resolved

- [ ] **Step 3: Implement `limits.ts`**

`web/engine/limits.ts`:

```ts
/** input caps, checked before any parsing work (see docs/design.md §9) */
export const LIMITS = {
  maxChars: 20_000,
  maxRows: 500,
  maxCell: 40,
  maxMeta: 120,
  maxExpandedRows: 1_000,
} as const
```

- [ ] **Step 4: Implement `chart.ts`**

`web/engine/chart.ts`:

```ts
import { LIMITS } from './limits'
import { defaultScale } from './qualities'

export type MetaKey = 'title' | 'subtitle'
export type ChartLine =
  | Readonly<{ kind: 'meta'; key: MetaKey; value: string }>
  | Readonly<{ kind: 'row'; section: string; bar: string; chord: string; scale: string }> // scale '' = default
  | Readonly<{ kind: 'copy'; src: string; dst: string; offset: number }>
  | Readonly<{ kind: 'comment'; text: string }>
  | Readonly<{ kind: 'blank' }>
  | Readonly<{ kind: 'invalid'; text: string }> // kept verbatim so text round-trips
export type ChartDoc = Readonly<{ lines: readonly ChartLine[] }>
export type Diagnostic = Readonly<{ line: number; message: string }> // line is 1-based
export type Row = Readonly<{ section: string; bar: string; chord: string; scale: string }>
export type Parsed<T> = Readonly<{ value: T; diagnostics: readonly Diagnostic[] }>

const INT_RE = /^[+-]?\d+$/
const OFFSET_RE = /^[+-]?\d{1,4}$/ // bar offsets stay well inside safe integers

function parseLine(line: string): ChartLine | string {
  if (!line) return { kind: 'blank' }
  if (line.startsWith('#')) return { kind: 'comment', text: line }
  const low = line.toLowerCase()
  for (const key of ['title', 'subtitle'] as const) {
    if (low.startsWith(`${key}:`)) {
      const value = line.slice(key.length + 1).trim()
      return value.length > LIMITS.maxMeta ? `${key} longer than ${LIMITS.maxMeta} characters` : { kind: 'meta', key, value }
    }
  }
  if (low.startsWith('@copy')) {
    const parts = line.split(/\s+/)
    if (parts.length !== 4 || !OFFSET_RE.test(parts[3])) return 'use  @copy SRC DST BAR_OFFSET'
    if (parts[1].length > LIMITS.maxCell || parts[2].length > LIMITS.maxCell)
      return `section name longer than ${LIMITS.maxCell} characters`
    return { kind: 'copy', src: parts[1], dst: parts[2], offset: Number(parts[3]) }
  }
  const cells = line.split('|').map((c) => c.trim())
  if (cells.length !== 3 && cells.length !== 4) return 'expected  section | bar | chord [| scale]'
  if (cells.some((c) => c.length > LIMITS.maxCell)) return `cell longer than ${LIMITS.maxCell} characters`
  const [section, bar, chord, scale = ''] = cells
  return { kind: 'row', section, bar, chord, scale }
}

/** tolerant parse: bad lines become 'invalid' lines plus a diagnostic, never an exception */
export function parseChart(text: string): Parsed<ChartDoc> {
  if (text.length > LIMITS.maxChars)
    return { value: { lines: [] }, diagnostics: [{ line: 0, message: `chart longer than ${LIMITS.maxChars} characters` }] }
  const diagnostics: Diagnostic[] = []
  const lines = text.split(/\r?\n/).map((raw, i): ChartLine => {
    const t = raw.trim()
    const parsed = parseLine(t)
    if (typeof parsed !== 'string') return parsed
    diagnostics.push({ line: i + 1, message: parsed })
    return { kind: 'invalid', text: t }
  })
  if (lines.length > 0 && lines[lines.length - 1].kind === 'blank') lines.pop() // trailing newline
  if (lines.filter((l) => l.kind === 'row').length > LIMITS.maxRows)
    diagnostics.push({ line: 0, message: `more than ${LIMITS.maxRows} rows` })
  return { value: { lines }, diagnostics }
}

/** canonical text: chord rows column-aligned, everything else verbatim */
export function serializeChart(doc: ChartDoc): string {
  const rows = doc.lines.filter((l) => l.kind === 'row')
  const width = (f: (r: (typeof rows)[number]) => string): number => Math.max(0, ...rows.map((r) => f(r).length))
  const [ws, wb, wc] = [width((r) => r.section), width((r) => r.bar), width((r) => r.chord)]
  const out = doc.lines.map((l): string => {
    switch (l.kind) {
      case 'meta':
        return `${l.key}: ${l.value}`
      case 'row': {
        const head = `${l.section.padEnd(ws)} | ${l.bar.padEnd(wb)} | `
        return l.scale ? `${head}${l.chord.padEnd(wc)} | ${l.scale}` : `${head}${l.chord}`
      }
      case 'copy':
        return `@copy ${l.src} ${l.dst} ${l.offset}`
      case 'comment':
      case 'invalid':
        return l.text
      case 'blank':
        return ''
    }
  })
  return out.join('\n') + '\n'
}

export function chartMeta(doc: ChartDoc): Readonly<{ title: string; subtitle: string }> {
  const meta = (key: MetaKey, fallback: string): string =>
    doc.lines.reduce((v, l) => (l.kind === 'meta' && l.key === key ? l.value : v), fallback)
  return { title: meta('title', 'Untitled'), subtitle: meta('subtitle', '') }
}

/** chart rows in order with @copy applied (a copy repeats the rows seen so far); at most maxExpandedRows */
export function expandRows(doc: ChartDoc): Parsed<readonly Row[]> {
  const diagnostics: Diagnostic[] = []
  const rows: Row[] = []
  const tooMany = (line: number): Diagnostic => ({ line, message: `more than ${LIMITS.maxExpandedRows} rows after @copy` })
  for (const [i, l] of doc.lines.entries()) {
    if (l.kind === 'row') {
      if (rows.length >= LIMITS.maxExpandedRows) {
        diagnostics.push(tooMany(i + 1))
        break
      }
      rows.push({ section: l.section, bar: l.bar, chord: l.chord, scale: l.scale })
    }
    if (l.kind !== 'copy') continue
    const src = rows.filter((r) => r.section === l.src)
    if (src.some((r) => !INT_RE.test(r.bar))) {
      diagnostics.push({ line: i + 1, message: `@copy needs whole-number bars in section ${l.src}` })
      continue
    }
    if (rows.length + src.length > LIMITS.maxExpandedRows) {
      // checked before growing: chained copies would otherwise double the rows each time
      diagnostics.push(tooMany(i + 1))
      break
    }
    rows.push(...src.map((r) => ({ ...r, section: l.dst, bar: String(Number(r.bar) + l.offset) })))
  }
  return { value: rows, diagnostics }
}

/** the row's scale, else the chord quality's default; null means "ask the user" */
export function resolveScale(row: Row): string | null {
  if (row.scale) return row.scale
  try {
    return defaultScale(row.chord)
  } catch {
    return null // unparseable chord
  }
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd web && npx vitest run engine/__tests__/chart.test.ts && npx tsc --noEmit`
Expected: `10 passed`

- [ ] **Step 6: Commit**

```bash
git add web/engine/limits.ts web/engine/chart.ts web/engine/__tests__/chart.test.ts
git commit -m "feat(engine): chart document model, @copy expansion, input limits"
```

---

### Task 11: Public barrel + golden parity

**Files:** Create: `web/engine/index.ts`, Test: `web/engine/__tests__/golden.test.ts`

- [ ] **Step 1: Write the parity test** (it imports from `..`, which doesn't exist yet)

`web/engine/__tests__/golden.test.ts`:

```ts
/**
 * Parity with jazz_scales.py: fixtures/golden.json holds the Python engine's answers
 * (regenerate with  python3 tools/export_fixtures.py). Each test collects every
 * mismatch so one run shows them all.
 */
import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import {
  type ChordToken,
  type Clef,
  type Part,
  type ScaleOption,
  chartMeta,
  chordTokens,
  defaultScale,
  expandRows,
  lilyNote,
  parseChart,
  resolveQuality,
  resolveScale,
  resolveStart,
  rootName,
  scaleLabel,
  scaleNotes,
} from '..'

type ScaleCase =
  | { error: true }
  | { root: string; label: string; root_notes: string[]; from: Record<string, string[]> }
type Golden = {
  parts: Record<string, Part>
  from_starts: string[]
  starts: Record<Clef, Record<string, number>>
  scales: Record<string, Record<string, ScaleCase>>
  chords: { part: string; chord: string; scale: string | null; tokens: ChordToken[] | null }[]
  options: Record<string, { options: ScaleOption[] | null; default: string | null }>
  charts: Record<string, { text: string; title: string; subtitle: string; rows: string[][] }>
}

const repo = (path: string): string => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
const G = JSON.parse(repo('fixtures/golden.json')) as Golden

/** engine domain errors are plain Errors (Python's ValueError); anything else is a bug and must fail */
const isDomainError = (e: unknown): boolean => e instanceof Error && e.constructor === Error

function attempt<T>(f: () => T): T | null {
  try {
    return f()
  } catch (e) {
    if (isDomainError(e)) return null
    throw e
  }
}

/** compare each [label, want, got]; return the first 20 readable mismatches plus a count */
function mismatches(cases: Iterable<readonly [string, unknown, unknown]>): string[] {
  const bad: string[] = []
  for (const [label, want, got] of cases)
    if (!isDeepStrictEqual(want, got)) bad.push(`${label}\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(got)}`)
  return bad.length > 20 ? [...bad.slice(0, 20), `... and ${bad.length - 20} more`] : bad
}

function scaleCase(part: Part, text: string): ScaleCase {
  try {
    const label = scaleLabel(part, text)
    return {
      root: rootName(label.root),
      label: label.name,
      root_notes: scaleNotes(part, text, 'root', 0).map(lilyNote),
      from: Object.fromEntries(
        G.from_starts.map((s) => [s, scaleNotes(part, text, 'from', resolveStart(part.clef, s)).map(lilyNote)]),
      ),
    }
  } catch (e) {
    if (isDomainError(e)) return { error: true }
    throw e
  }
}

describe('golden parity with jazz_scales.py', () => {
  it('fixture has every section', () => {
    expect(Object.keys(G.parts)).toHaveLength(5)
    expect(Object.keys(G.scales)).toEqual(Object.keys(G.parts))
    for (const section of [G.from_starts, G.chords, Object.keys(G.options), Object.keys(G.charts)])
      expect(section.length).toBeGreaterThan(0)
  })

  it('start notes', () => {
    const cases = Object.entries(G.starts).flatMap(([clef, starts]) =>
      Object.entries(starts).map(([s, want]) => [`${clef} ${s}`, want, resolveStart(clef as Clef, s)] as const),
    )
    expect(mismatches(cases)).toEqual([])
  })

  for (const [partId, cases] of Object.entries(G.scales)) {
    it(`scales, ${partId}`, () => {
      const part = G.parts[partId]
      expect(mismatches(Object.entries(cases).map(([t, want]) => [t, want, scaleCase(part, t)] as const))).toEqual([])
    })
  }

  it('chord symbols', () => {
    const cases = G.chords.map(
      (c) =>
        [
          `${c.part} ${c.chord} / ${c.scale}`,
          c.tokens,
          attempt(() => chordTokens(G.parts[c.part], c.chord, c.scale ?? undefined)),
        ] as const,
    )
    expect(mismatches(cases)).toEqual([])
  })

  it('quality options and defaults', () => {
    const cases = Object.entries(G.options).flatMap(([chord, want]) => [
      [`${chord} options`, want.options, attempt(() => resolveQuality(chord)?.options ?? null)] as const,
      [`${chord} default`, want.default, attempt(() => defaultScale(chord))] as const,
    ])
    expect(mismatches(cases)).toEqual([])
  })

  it('library charts', () => {
    const cases = Object.entries(G.charts).flatMap(([name, want]) => {
      const { value: doc, diagnostics } = parseChart(want.text)
      const rows = expandRows(doc)
      return [
        [`${name} diagnostics`, [], [...diagnostics, ...rows.diagnostics]] as const,
        [`${name} meta`, { title: want.title, subtitle: want.subtitle }, chartMeta(doc)] as const,
        [`${name} rows`, want.rows, rows.value.map((r) => [r.section, r.bar, r.chord, resolveScale(r)])] as const,
      ]
    })
    expect(mismatches(cases)).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run engine/__tests__/golden.test.ts`
Expected: FAIL, the module `..` cannot be resolved

- [ ] **Step 3: Create the barrel**

`web/engine/index.ts`:

```ts
export * from './chart'
export * from './chord'
export * from './instruments'
export * from './limits'
export * from './part'
export * from './pitch'
export * from './qualities'
export * from './scales'
```

- [ ] **Step 4: Run the full suite**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: `Test Files 7 passed`, `Tests 40 passed`

- [ ] **Step 5: Prove the parity test bites.** Corrupt one expected value:

```bash
python3 -c "import json;p='fixtures/golden.json';g=json.load(open(p));g['scales']['treble/Bb']['B dorian']['root']='Db';json.dump(g,open(p,'w'),ensure_ascii=False)"
```

Run: `cd web && npx vitest run engine/__tests__/golden.test.ts`
Expected: 1 FAIL, `want … "root":"Db" … got … "root":"C#"`. Then restore the file with `.venv/bin/python tools/export_fixtures.py` and re-run (pass).

- [ ] **Step 6: Commit**

```bash
git add web/engine/index.ts web/engine/__tests__/golden.test.ts
git commit -m "test(engine): golden parity with jazz_scales.py"
```

---

### Task 12: Tooling, CI, project notes

**Files:** Modify: `Makefile`, `CLAUDE.md`; Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace `Makefile`**

```makefile
CHART ?= charts/autumn_leaves.txt
INST  ?= concert
PY    ?= .venv/bin/python

.PHONY: pdf setup test fixtures clean
pdf:
	python3 jazz_scales.py $(CHART) -i $(INST) -o output/$(notdir $(basename $(CHART)))_$(INST)
setup:
	python3 -m venv .venv && $(PY) -m pip install -q pytest
	cd web && npm ci
test:
	$(PY) -m pytest tests
	cd web && npm run typecheck && npm test
fixtures:
	$(PY) tools/export_fixtures.py
clean:
	rm -f output/*.pdf output/*.ly
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`.** CI runs pytest (including fixture freshness), typecheck, vitest and `npm audit`, with read-only permissions.

`.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
permissions:
  contents: read
jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install pytest
      - run: python -m pytest tests
  engine:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm audit --audit-level=high
```

- [ ] **Step 3: Update `CLAUDE.md`.** Under "Working here", replace the pytest bullet with

```markdown
- `make setup` once, then `make test` after changes: pytest (scale spelling, transposition,
  enharmonic choice, chart parsing, fixture freshness) plus the TS engine's typecheck and vitest.
- `web/engine/` is a TS port of the Python engine. After changing `jazz_scales.py`,
  `chord_scales.json` or `charts/`, run `make fixtures` and port the change to TS. The golden
  parity test (`web/engine/__tests__/golden.test.ts`) fails until both agree.
```

and under "Design rules" add

```markdown
- Chart rows may omit the scale; both engines use the quality's default from `chord_scales.json`.
```

- [ ] **Step 4: Verify everything from clean**

Run: `make test`
Expected: `12 passed`, then `Test Files 7 passed`, `Tests 40 passed`

- [ ] **Step 5: Commit**

```bash
git add Makefile CLAUDE.md .github/workflows/ci.yml
git commit -m "chore: make targets, CI, project notes for the TS engine"
```

---

## Notes for phase 2 (not in this plan)

- **Stack:** Nuxt 4 (decided) with Tailwind CSS v4 via `@tailwindcss/vite` (see design §6).
- **Imports outside `web/`.** The engine imports `../../chord_scales.json`, and the library will import `../../charts/*.txt`. The Vite dev server only serves files inside its root, so set `vite.server.fs.allow: ['..']`, and enable Vercel's "include files outside root directory" setting.
- **Grid cell validation.** `serializeChart` doesn't sanitize. The grid editor must reject cell values containing `|`, `\r`/`\n`, or a leading `#`, `@`, `title:` or `subtitle:`, or the text round-trip breaks. A `maxChars` diagnostic returns an empty doc, so the editor must not write it back over the user's text.
- **Engine boundaries.** `web/engine/` must stay free of Vue/DOM imports. A future lint rule (`no-restricted-imports` for `vue`, `#app`) will enforce it.
