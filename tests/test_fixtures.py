import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import export_fixtures


def test_golden_fixture_is_up_to_date():
    assert export_fixtures.FIXTURE.read_text(encoding="utf-8") == export_fixtures.render(), \
        "fixtures/golden.json is stale: run  python3 tools/export_fixtures.py"
