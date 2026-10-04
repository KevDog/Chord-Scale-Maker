#!/usr/bin/env python3
"""Write fixtures/golden.json: jazz_scales.py's answers for the TS engine's parity tests.

Run after any change to jazz_scales.py, chord_scales.json or charts/:
  python3 tools/export_fixtures.py
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import jazz_scales as j  # noqa: E402

FIXTURE = ROOT / "fixtures" / "golden.json"
PARTS = {f"{c}/{t}": (c, t) for c, t in
         [("treble", "C"), ("treble", "Bb"), ("treble", "Eb"), ("treble", "F"), ("bass", "C")]}
ROOTS = [l + a for l in "CDEFGAB" for a in ("b", "", "#")]
FROM_STARTS = ["C", "Eb", "F#3"]
START_TEXTS = ["C", "Eb", "F#3", "Cb", "B#", "G2", "Bb5", "f#"]
SCALE_TEXTS = ([f"{r} {k}" for r in ROOTS for k in j.SCALES]
               + [f"D {a}" for a in j.ALIASES]
               + sorted({f"Eb {o['scale']}" for opts in j.QUALITIES.values() for o in opts})
               + ["C Dorain", "H Dorian", "C", "Bb  half-whole dim."])
CHORDS = ["Cm7", "C-7", "Cmi7", "Cmin7", "Bbm7", "Am7b5", "D7#5", "G7#9b13", "EbMaj7", "Cmaj7",
          "CMaj7", "C9", "D7/F#", "Cm6/Eb", "C6/9", "Cm6/9", "F#m7", "Gm", "C", "Bm7", "Db7(b9)",
          "Abmin7", "E7alt", "Bb7sus4", "F#ø7", "Cdim7", "Gbm7b5", "C#m7", "B7b9", "E7(#11)",
          "Fmaj7#11", "Bb13", "Ebm(maj7)", "Ab7/Gb", "G/B", "Cm7#5#9x"]


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
    out = []
    for m in re.finditer(r'"([^"]*)"|\\(fl|sh)', markup):
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
    charts = {}
    for f in sorted((ROOT / "charts").glob("*.txt")):
        title, subtitle, rows = j.read_chart(f)
        charts[f.stem] = {"title": title, "subtitle": subtitle, "rows": [list(r) for r in rows]}
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
