import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import jazz_scales as j


def notes(part, scale, mode="root", start=60):
    return " ".join(part.scale_notes(scale, mode, start))


def test_scale_spelling_from_root():
    p = j.Part("treble", "C")
    assert notes(p, "C Dorian") == "c' d' ees' f' g' a' bes'"
    assert notes(p, "Bb Dorian") == "bes c' des' ees' f' g' aes'"
    assert notes(p, "A Locrian") == "a' bes' c'' d'' ees'' f'' g''"
    assert notes(p, "D Half-Whole") == "d' ees' f' fis' gis' a' b' c''"
    assert notes(p, "F Altered") == "f' ges' aes' a' b' des'' ees''"
    assert notes(p, "G Altered") == "g' aes' bes' b' cis'' ees'' f''"


def test_spelling_from_fixed_note():
    p = j.Part("treble", "C")
    assert notes(p, "F Mixolydian", "from") == "c' d' ees' f' g' a' bes'"
    assert notes(p, "B Dorian", "from") == "cis' d' e' fis' gis' a' b'"   # no C in scale
    assert notes(p, "G Half-Whole", "from", 63) == "e' f' g' aes' bes' b' cis'' d''"


def test_aliases_and_unknown():
    assert j.parse_scale("G Half Whole Dim")[2] == "half whole diminished"
    assert j.parse_scale("C major")[2] == "ionian"
    try:
        j.parse_scale("C Dorain")
        assert False
    except ValueError:
        pass


def test_transposition_of_roots():
    bb, eb = j.Part("treble", "Bb"), j.Part("treble", "Eb")
    def root(part, scale):
        li, acc, _, _ = part.scale(scale)
        return j.root_name(li, acc)
    assert root(bb, "C Dorian") == "D"
    assert root(bb, "B Dorian") == "C#"      # not Db (Fb/Cb)
    assert root(bb, "E Mixolydian") == "F#"
    assert root(bb, "C# Dorian") == "Eb"     # not D# (E#, B#)
    assert root(eb, "C Dorian") == "A"
    assert root(eb, "Eb Lydian") == "C"
    assert root(eb, "Bb Dorian") == "G"


def test_chord_symbols():
    c, bb = j.Part("treble", "C"), j.Part("treble", "Bb")
    assert c.chord_markup("Cm7") == r'\concat { "C" "–7" }'
    assert c.chord_markup("Am7b5") == r'\concat { "A" "–7" "(" \fl "5" ")" }'
    assert bb.chord_markup("D7/F#", "D Half-Whole") == r'\concat { "E" "7" "/G" \sh }'
    assert bb.chord_markup("Bm7", "B Dorian").startswith(r'\concat { "C" \sh')


def test_bass_clef_range():
    p = j.Part("bass", "C")
    assert notes(p, "C Dorian") == "c d ees f g a bes"


def test_chart_parsing(tmp_path):
    f = tmp_path / "t.txt"
    f.write_text("title: T\nA | 1 | Cm7 | C Dorian\nA | 2 | F7 | F Mixolydian\n@copy A B 8\n")
    title, sub, rows = j.read_chart(f)
    assert title == "T" and len(rows) == 4
    assert rows[2] == ("B", "9", "Cm7", "C Dorian")


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


def test_every_json_scale_is_known():
    for quality, opts in j.QUALITIES.items():
        for o in opts:
            j.parse_scale("C " + o["scale"])
        assert sum(1 for o in opts if o.get("default")) == 1, quality
