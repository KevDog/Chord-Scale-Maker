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
          "Csus", "C7sus4b9", "Ephryg", "DbMaj7/C", "Gbmaj7/F", "Dbmaj7/B#", "DbMaj7/F",  # sus b9, slash readings
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
