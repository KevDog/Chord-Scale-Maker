#!/usr/bin/env python3
"""
jazz_scales.py - turn a chord chart into a staff-paper PDF of chord scales.

Each bar/chord gets one staff of whole notes (no time signature) with the
chord name and scale name to the left of the notes. Scales are COMPUTED from
their names, so there are no hand-typed spellings to get wrong.

Output (default) is two parts in one PDF:
  1. every scale spelled from one fixed note (middle C unless --from)
  2. every scale spelled from its own root

The chart is always written in CONCERT pitch. Pick an instrument and the
tool transposes the notes, chord symbols and scale names for that player,
and uses the right clef. --from is a WRITTEN pitch (what the player sees).

Requires: Python 3.8+ and LilyPond (apt install lilypond / brew install lilypond)

Usage:
  python3 jazz_scales.py chart.txt                       # concert, treble clef
  python3 jazz_scales.py chart.txt --instrument tenor-sax
  python3 jazz_scales.py chart.txt --instrument trombone
  python3 jazz_scales.py chart.txt --clef bass --transpose Bb   # manual override
  python3 jazz_scales.py chart.txt --from Eb             # start every scale on Eb
  python3 jazz_scales.py chart.txt --mode root           # only spelled from root
  python3 jazz_scales.py chart.txt -o my_tune            # choose output name
  python3 jazz_scales.py chart.txt --per-page 12         # force staves per page
  python3 jazz_scales.py --list-scales / --list-instruments

Chart format (plain text):
  title: Autumn Leaves
  subtitle: Full Form, Alternate Changes
  # section | bar | chord | scale
  A1 | 1 | Cm7   | C Dorian
  A1 | 3 | Bm7   | B Dorian
  A1 | 3 | E7    | E Mixolydian       <- two chords in one bar = two rows
  A1 | 4 | Bbm7                        <- scale omitted: quality default from chord_scales.json
  @copy A1 A2 8                        <- repeat section A1 as A2, bars +8
Chords: Cm7, Bbm7, Am7b5, D7#5, EbMaj7, D7/F#, C9 ... (m = minor, shown as -)
Scales: "<root> <name>", e.g. "Bb Dorian", "D Half-Whole", "G Altered".
"""
import argparse, json, math, re, shutil, subprocess, sys
from pathlib import Path

LETTERS = "CDEFGAB"
NAT_PC = [0, 2, 4, 5, 7, 9, 11]          # semitones of C D E F G A B
MAJOR = NAT_PC                            # major-scale degree -> semitones

# --- scales -----------------------------------------------------------------
# name: (degree formula, label printed on the page)
SCALES = {
    "ionian":               ("1 2 3 4 5 6 7",        "Ionian"),
    "dorian":               ("1 2 b3 4 5 6 b7",      "Dorian"),
    "phrygian":             ("1 b2 b3 4 5 b6 b7",    "Phrygian"),
    "lydian":               ("1 2 3 #4 5 6 7",       "Lydian"),
    "mixolydian":           ("1 2 3 4 5 6 b7",       "Mixolydian"),
    "aeolian":              ("1 2 b3 4 5 b6 b7",     "Aeolian"),
    "locrian":              ("1 b2 b3 4 b5 b6 b7",   "Locrian"),
    "locrian natural 2":    ("1 2 b3 4 b5 b6 b7",    "Locrian \u266e2"),
    "melodic minor":        ("1 2 b3 4 5 6 7",       "Melodic Minor"),
    "harmonic minor":       ("1 2 b3 4 5 b6 7",      "Harmonic Minor"),
    "lydian dominant":      ("1 2 3 #4 5 6 b7",      "Lydian Dominant"),
    "lydian augmented":     ("1 2 3 #4 #5 6 7",      "Lydian Augmented"),
    "altered":              ("1 b2 b3 3 #4 b6 b7",   "Altered"),
    "phrygian dominant":    ("1 b2 3 4 5 b6 b7",     "Phrygian Dominant"),
    "dorian b2":            ("1 b2 b3 4 5 6 b7",     "Dorian \u266d2"),
    "mixolydian b6":        ("1 2 3 4 5 b6 b7",      "Mixolydian \u266d6"),
    "half whole diminished":("1 b2 b3 3 #4 5 6 b7",  "Half-Whole Dim."),
    "whole half diminished":("1 2 b3 4 b5 b6 6 7",   "Whole-Half Dim."),
    "whole tone":           ("1 2 3 #4 #5 b7",       "Whole Tone"),
    "major pentatonic":     ("1 2 3 5 6",            "Major Pentatonic"),
    "minor pentatonic":     ("1 b3 4 5 b7",          "Minor Pentatonic"),
    "blues":                ("1 b3 4 b5 5 b7",       "Blues"),
    "bebop dominant":       ("1 2 3 4 5 6 b7 7",     "Bebop Dominant"),
    "bebop major":          ("1 2 3 4 5 b6 6 7",     "Bebop Major"),
    "bebop dorian":         ("1 2 b3 3 4 5 6 b7",    "Bebop Dorian"),
}
ALIASES = {
    "major": "ionian", "minor": "aeolian", "natural minor": "aeolian",
    "locrian 2": "locrian natural 2", "locrian #2": "locrian natural 2",
    "lydian b7": "lydian dominant", "lydian #5": "lydian augmented",
    "super locrian": "altered", "diminished whole half": "whole half diminished",
    "half whole": "half whole diminished", "hw": "half whole diminished",
    "half whole dim": "half whole diminished", "dominant diminished": "half whole diminished",
    "whole half": "whole half diminished", "wh": "whole half diminished",
    "whole half dim": "whole half diminished", "diminished": "whole half diminished",
    "phrygian natural 6": "dorian b2", "aeolian dominant": "mixolydian b6",
    "bebop": "bebop dominant",
}

# --- instruments ------------------------------------------------------------
# written = concert + interval. (letter steps, semitones) up from concert.
TRANSPOSITIONS = {"C": (0, 0), "Bb": (1, 2), "Eb": (5, 9), "F": (4, 7)}
# name: (clef, transposition, description). Octave transpositions (guitar, bass,
# tenor, bari) do not matter here: every scale is placed in a comfortable
# written range on the staff, so only the key matters.
INSTRUMENTS = {
    "concert":      ("treble", "C",  "any C instrument, treble clef (piano RH, vibes, flute, violin)"),
    "piano":        ("treble", "C",  "same as concert"),
    "vibes":        ("treble", "C",  "same as concert"),
    "flute":        ("treble", "C",  "same as concert"),
    "guitar":       ("treble", "C",  "same as concert"),
    "trumpet":      ("treble", "Bb", "Bb, written a major 2nd up"),
    "flugelhorn":   ("treble", "Bb", "same as trumpet"),
    "clarinet":     ("treble", "Bb", "same as trumpet"),
    "soprano-sax":  ("treble", "Bb", "same as trumpet"),
    "tenor-sax":    ("treble", "Bb", "same key as trumpet (sounds an octave lower)"),
    "alto-sax":     ("treble", "Eb", "Eb, written a major 6th up"),
    "bari-sax":     ("treble", "Eb", "same key as alto (sounds an octave lower)"),
    "horn":         ("treble", "F",  "French horn in F, written a perfect 5th up"),
    "trombone":     ("bass",   "C",  "bass clef, concert pitch"),
    "tuba":         ("bass",   "C",  "bass clef, concert pitch"),
    "bass":         ("bass",   "C",  "bass clef, concert pitch"),
}
CLEF_START = {"treble": 60, "bass": 48}       # default --from pitch: C4 / C3
CLEF_ROOT_LOW = {"treble": 58, "bass": 43}    # root-spelled scales start in Bb3..A4 / G2..F#3


# --- pitch helpers ----------------------------------------------------------
def norm(s):
    return re.sub(r"\s+", " ", s.lower().replace("-", " ").replace("\u266e", "natural ").replace("\u266d", "b").replace("\u266f", "#").replace(".", "")).strip()


def parse_root(tok):
    m = re.fullmatch(r"([A-Ga-g])([b#\u266d\u266f]*)", tok)
    if not m:
        raise ValueError(f"bad note name: {tok!r}")
    acc = sum(1 if c in "#\u266f" else -1 for c in m.group(2))
    return LETTERS.index(m.group(1).upper()), acc


def root_name(li, acc):
    return LETTERS[li] + ("#" * acc if acc > 0 else "b" * -acc)


def pc_of(li, acc):
    return (NAT_PC[li] + acc) % 12


def acc_for(pc, letter):
    return ((pc - NAT_PC[letter] + 6) % 12) - 6


def transpose_root(li, acc, trans):
    """move a spelled note up by a (letter steps, semitones) interval"""
    steps, semis = TRANSPOSITIONS[trans]
    nl = (li + steps) % 7
    return nl, acc_for((pc_of(li, acc) + semis) % 12, nl)


def enharmonics(li, acc):
    """all spellings of this pitch class with at most one accidental"""
    pc = pc_of(li, acc)
    out = []
    for l in range(7):
        a = acc_for(pc, l)
        if abs(a) <= 1:
            out.append((l, a))
    return out


UGLY = {(6, 1), (2, 1), (0, -1), (3, -1)}      # B#, E#, Cb, Fb


def simplify_root(li, acc, scale_key=None):
    """pick the friendliest spelling of a root by looking at the whole scale:
    no B#/E#/Cb/Fb or double accidentals if avoidable, then fewest accidentals;
    ties keep the original direction, else flats (but F# over Gb)"""
    formula = SCALES[scale_key or "ionian"][0]
    def cost(opt):
        l, a = opt
        notes = spell_from(l, a, formula)
        ugly = sum(1 for x in notes if (x[0], x[1]) in UGLY or abs(x[1]) > 1)
        total = sum(abs(x[1]) for x in notes)
        same_dir = 0 if (a == acc or acc == 0 and (a <= 0 or pc_of(l, a) == 6)) else 1
        return (ugly, total, same_dir)
    return min(enharmonics(li, acc), key=cost)


def spell_from(li, racc, formula):
    """-> [(letter, acc, semis_above_root)] for a scale formula on a root"""
    root_pc = pc_of(li, racc)
    notes = []
    for tok in formula.split():
        m = re.fullmatch(r"([b#]*)(\d+)", tok)
        n = int(m.group(2))
        idx = (n - 1) % 7
        semis = MAJOR[idx] + m.group(1).count("#") - m.group(1).count("b")
        letter = (li + idx) % 7
        notes.append((letter, acc_for((root_pc + semis) % 12, letter), semis))
    return notes


def parse_scale(scale_text):
    """-> (root_letter, root_acc, scale_key)"""
    parts = scale_text.split(None, 1)
    if len(parts) != 2:
        raise ValueError(f"scale needs a root and a name: {scale_text!r}")
    li, racc = parse_root(parts[0])
    key = norm(parts[1])
    key = ALIASES.get(key, key)
    if key not in SCALES:
        raise ValueError(f"unknown scale {parts[1]!r} (run --list-scales)")
    return li, racc, key


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


def spell_scale(li, racc, key):
    notes = spell_from(li, racc, SCALES[key][0])
    if any(abs(n[1]) > 2 for n in notes):
        raise ValueError(f"{root_name(li, racc)} {key} needs a triple accidental; pick an enharmonic root")
    if any(b[2] <= a[2] for a, b in zip(notes, notes[1:])):
        raise ValueError(f"scale formula not ascending: {key}")
    return notes


def lily_note(letter, acc, pitch):
    o = (pitch - NAT_PC[letter] - acc) // 12 - 1          # written octave, C4 = 60
    assert (pitch - NAT_PC[letter] - acc) % 12 == 0
    name = LETTERS[letter].lower() + ("is" * acc if acc > 0 else "es" * -acc)
    marks = o - 3
    return name + ("'" * marks if marks >= 0 else "," * -marks)


def parse_start(text):
    """'C' -> 60, 'Eb' -> 63, 'F#3' -> 54 (octave defaults to 4, middle C = C4)"""
    m = re.fullmatch(r"([A-Ga-g][b#\u266d\u266f]*)(\d)?", text.strip())
    if not m:
        raise ValueError(f"bad start note {text!r} (try C, Eb, F#3)")
    li, acc = parse_root(m.group(1))
    return 12 * (int(m.group(2)) + 1) + NAT_PC[li] + acc if m.group(2) else None, NAT_PC[li] + acc


# --- an instrument "view" of the chart -------------------------------------
class Part:
    def __init__(self, clef, trans):
        self.clef, self.trans = clef, trans

    def written_root(self, li, acc, scale_key=None):
        if self.trans == "C":
            return li, acc
        return simplify_root(*transpose_root(li, acc, self.trans), scale_key)

    def scale(self, scale_text):
        li, racc, key = parse_scale(scale_text)
        li, racc = self.written_root(li, racc, key)
        return li, racc, key, spell_scale(li, racc, key)

    def scale_notes(self, scale_text, mode, start):
        li, racc, key, notes = self.scale(scale_text)
        root_pc = pc_of(li, racc)
        if mode == "root":
            low = CLEF_ROOT_LOW[self.clef]
            p0 = low + (root_pc - low) % 12
            seq = [(l, a, p0 + s) for l, a, s in notes]
        else:   # every note in the octave beginning at the start pitch
            seq = sorted(((l, a, start + (root_pc + s - start) % 12) for l, a, s in notes), key=lambda x: x[2])
        return [lily_note(*n) for n in seq]

    def scale_label(self, scale_text):
        li, racc, key, _ = self.scale(scale_text)
        parts = [f'"{LETTERS[li]}"']
        if racc:
            parts.append(acc_markup("#" * racc if racc > 0 else "b" * -racc))
        parts.append(f'" {SCALES[key][1]}"')
        return r"\concat { " + " ".join(parts) + " }"

    def chord_markup(self, txt, scale_text=None):
        m = re.fullmatch(CHORD_RE, txt.strip())
        if not m:
            raise ValueError(f"cannot parse chord {txt!r}")
        root, racc, rest, bass, bacc = m.groups()
        root0, racc0 = root, racc
        li, acc = parse_root(root + racc)
        sl, sa, skey = parse_scale(scale_text) if scale_text else (None, None, None)
        if sl is not None and pc_of(sl, sa) == pc_of(li, acc):
            li, acc = self.written_root(sl, sa, skey)       # match the scale's spelling
        else:
            li, acc = self.written_root(li, acc)
        root, racc = LETTERS[li], ("#" * acc if acc > 0 else "b" * -acc)
        rest = rest.replace("(", "").replace(")", "")
        rest = re.sub(r"^(?:min|mi|m(?!a))", "\u2013", rest)   # minor -> en dash
        rest = re.sub(r"^-", "\u2013", rest)
        rest = re.sub(r"^ma(?:j)?", "Maj", rest)
        parts = [f'"{root}"']
        if racc:
            parts.append(acc_markup(racc))
        pos = 0
        for run in re.finditer(r"(?:[b#]\d+)+", rest):
            if run.start() > pos:
                parts.append(f'"{rest[pos:run.start()]}"')
            parts.append('"("')
            alts = re.findall(r"([b#])(\d+)", run.group())
            for i, (a, n) in enumerate(alts):
                parts.append(acc_markup(a))
                parts.append(f'"{n}{"," if i < len(alts) - 1 else ""}"')
            parts.append('")"')
            pos = run.end()
        if pos < len(rest):
            parts.append(f'"{rest[pos:]}"')
        if bass:   # keep the bass note's interval from the (new) root, e.g. D7/F# -> E7/G#
            ol, oa = parse_root(root0 + racc0)
            bl0, ba0 = parse_root(bass + (bacc or ""))
            bl = (li + (bl0 - ol)) % 7
            ba = acc_for((pc_of(li, acc) + (pc_of(bl0, ba0) - pc_of(ol, oa))) % 12, bl)
            if abs(ba) > 1:
                bl, ba = simplify_root(bl, ba)
            parts.append(f'"/{LETTERS[bl]}"')
            if ba:
                parts.append(acc_markup("#" * ba if ba > 0 else "b" * -ba))
        return r"\concat { " + " ".join(parts) + " }"


def acc_markup(acc_chars):
    return " ".join(r"\fl" if c in "b\u266d" else r"\sh" for c in acc_chars)


def note_text(text):
    """'Eb' -> 'E\u266d' for the page subtitle"""
    return re.sub(r"[b#\u266d\u266f]", lambda m: "\u266d" if m.group() in "b\u266d" else "\u266f",
                  re.sub(r"\d", "", text.strip())).capitalize()


# --- chart file --------------------------------------------------------------
def read_chart(path):
    title, subtitle, rows = "Untitled", "", []
    for n, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        low = line.lower()
        if low.startswith("title:"):
            title = line.split(":", 1)[1].strip()
        elif low.startswith("subtitle:"):
            subtitle = line.split(":", 1)[1].strip()
        elif low.startswith("@copy"):
            try:
                _, src, dst, off = line.split()
                rows += [(dst, str(int(b) + int(off)), c, s) for (sec, b, c, s) in list(rows) if sec == src]
            except ValueError:
                sys.exit(f"line {n}: use  @copy SRC DST BAR_OFFSET")
        else:
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
    if not rows:
        sys.exit("chart has no rows")
    return title, subtitle, rows


# --- LilyPond ---------------------------------------------------------------
def build_ly(title, subtitle, rows, modes, per_page, part, start, start_text, inst_label):
    src = [r'\version "2.24.0"', '#(set-default-paper-size "letter")',
           r'\paper { score-system-spacing.basic-distance = #10 top-margin = 10\mm bottom-margin = 10\mm print-first-page-number = ##t }',
           r'\header { tagline = ##f }',
           r'fl = \markup { \hspace #0.1 \raise #0.6 \fontsize #-2 \flat }',
           r'sh = \markup { \hspace #0.1 \raise #0.6 \fontsize #-2 \sharp }']
    names = {"from": f"Spelled from {note_text(start_text)}", "root": "Spelled from the Root"}
    for mode in modes:
        bits = [b for b in (subtitle, inst_label) if b]
        sub = (" \u2013 ".join(bits) + f" ({names[mode]})") if bits else names[mode]
        src.append(rf'\bookpart {{ \header {{ title = "{title}" subtitle = "{sub}" }}')
        for i, (sec, bar, chord, scale) in enumerate(rows):
            notes = part.scale_notes(scale, mode, start)
            notes[0] += "1"
            last = i == len(rows) - 1
            src.append(rf'''\score {{
  \new Staff \with {{ \omit TimeSignature instrumentName = \markup \left-column {{ \fontsize #-2 \sans "{sec} · Bar {bar}" \bold \fontsize #2 {part.chord_markup(chord, scale)} \italic {part.scale_label(scale)} }} }} {{
    \clef {part.clef} \cadenzaOn \accidentalStyle forget {" ".join(notes)} \bar "{'|.' if last else '||'}"
  }}
  \layout {{ indent = 38\mm ragged-right = ##f \context {{ \Staff \override InstrumentName.self-alignment-X = #LEFT }} }}
}}''')
            if not last and (i + 1) % per_page == 0:
                src.append(r"\pageBreak")
        src.append("}")
    return "\n".join(src) + "\n"


def count_pages(pdf):
    if shutil.which("pdfinfo"):
        out = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
        m = re.search(r"Pages:\s+(\d+)", out)
        return int(m.group(1)) if m else None
    n = len(re.findall(rb"/Type\s*/Page[^s]", pdf.read_bytes()))
    return n or None


def main():
    ap = argparse.ArgumentParser(description="Chord-scale staff paper from a chord chart")
    ap.add_argument("chart", nargs="?")
    ap.add_argument("-o", "--output", help="output basename (default: from title and instrument)")
    ap.add_argument("--instrument", "-i", default="concert", metavar="NAME",
                    help="instrument preset (see --list-instruments); default concert")
    ap.add_argument("--clef", choices=["treble", "bass"], help="override the preset's clef")
    ap.add_argument("--transpose", choices=list(TRANSPOSITIONS), help="override the preset's transposition")
    ap.add_argument("--mode", choices=["from", "root", "both", "c"], default="both",
                    help="'from' = all scales start on the --from note; 'root' = each from its root; both (default)")
    ap.add_argument("--from", dest="start", default=None, metavar="NOTE",
                    help="WRITTEN start note for the 'from' part, e.g. C, Eb, F#3 (default C4 treble, C3 bass)")
    ap.add_argument("--per-page", type=int, default=None,
                    help="staves per page (default: auto-pick the densest layout that fits)")
    ap.add_argument("--no-pdf", action="store_true", help="write .ly only")
    ap.add_argument("--list-scales", action="store_true")
    ap.add_argument("--list-instruments", action="store_true")
    a = ap.parse_args()
    if a.list_scales:
        for k, (f, lab) in SCALES.items():
            print(f"{k:24s} {f}")
        print("\naliases:", ", ".join(sorted(ALIASES)))
        return
    if a.list_instruments:
        for k, (clef, tr, desc) in INSTRUMENTS.items():
            print(f"{k:14s} {clef:7s} {tr:3s}   {desc}")
        return
    if not a.chart:
        ap.error("chart file required")
    if a.instrument not in INSTRUMENTS:
        sys.exit(f"unknown instrument {a.instrument!r} (run --list-instruments)")
    clef, trans, _ = INSTRUMENTS[a.instrument]
    clef, trans = a.clef or clef, a.transpose or trans
    part = Part(clef, trans)
    inst_label = "" if a.instrument == "concert" and not (a.clef or a.transpose) else \
        a.instrument.replace("-", " ").title() + ("" if trans == "C" else f" ({trans})")

    title, subtitle, rows = read_chart(a.chart)
    for sec, bar, chord, scale in rows:        # validate everything up front
        try:
            part.chord_markup(chord, scale)
            part.scale(scale)
        except ValueError as e:
            sys.exit(f"error in row [{sec} | {bar} | {chord} | {scale}]: {e}")
    modes = ["from", "root"] if a.mode == "both" else ["from" if a.mode == "c" else a.mode]
    start_text = a.start or "C"
    try:
        exact, pc = parse_start(start_text)
    except ValueError as e:
        sys.exit(str(e))
    base_start = CLEF_START[clef]
    start = exact if exact is not None else base_start + (pc - base_start) % 12

    base = a.output or re.sub(r"\W+", "_", title.lower()).strip("_") + "_scales" + \
        ("" if a.instrument == "concert" else "_" + a.instrument.replace("-", "_"))
    ly = Path(base + ".ly")

    def write_ly(per_page):
        ly.write_text(build_ly(title, subtitle, rows, modes, per_page, part, start, start_text, inst_label),
                      encoding="utf-8")

    def compile_ly():
        r = subprocess.run(["lilypond", "-dno-point-and-click", "-o", base, str(ly)],
                           capture_output=True, text=True)
        if r.returncode:
            sys.exit(r.stderr)

    if a.no_pdf:
        write_ly(a.per_page or 12)
        print(f"wrote {ly}")
        return
    if not shutil.which("lilypond"):
        write_ly(a.per_page or 12)
        sys.exit(f"wrote {ly}, but LilyPond was not found - install it, or open the .ly in Frescobaldi")
    if a.per_page:
        write_ly(a.per_page)
        compile_ly()
    else:   # try the densest layout first; keep it only if no page overflows
        n = len(rows)
        for per_page in range(14, 5, -1):
            write_ly(per_page)
            compile_ly()
            got = count_pages(Path(base + ".pdf"))
            if got is None or got == math.ceil(n / per_page) * len(modes):
                break
    print(f"wrote {ly}\nwrote {base}.pdf")


if __name__ == "__main__":
    main()
