"""Focused source-boundary and normalization checks for the map seed."""

from pathlib import Path
import unittest

from prepare_map_snapshot import build_payload, normalize_governorate, normalize_stage, read_rows

WORKBOOK = Path(__file__).resolve().parents[1] / "Participants List.xlsx"


class PrepareMapSnapshotTests(unittest.TestCase):
    def test_workbook_aggregates_reconcile(self):
        if not WORKBOOK.exists():
            self.skipTest("Private source workbook is unavailable")
        rows = read_rows(WORKBOOK)
        payload = build_payload(rows)
        self.assertEqual(payload["nationwide"], {
            "total": 266, "represented_governorates": 8,
            "stages": {"Acceleration": 150, "Grow+": 24, "Go to Market": 92},
        })
        self.assertEqual(len(payload["governorates"]), 8)
        self.assertEqual(payload["governorates"]["amman"]["total"], 23)
        self.assertEqual(payload["governorates"]["maan"]["stages"]["Go to Market"], 3)
        self.assertEqual(rows[267]["B"], "Rewaq")
        self.assertFalse(rows[267]["A"])
        self.assertEqual(rows[270]["B"], "Partner Name")

    def test_unknown_stage_fails_instead_of_being_guessed(self):
        rows = {
            1: {"A": "E4DE Code", "B": "Startup Name", "F": "Governorate", "G": "Stage"},
            2: {"B": "Synthetic startup", "F": "Aqaba", "G": "Acceleration / unreviewed programme"},
            270: {"B": "Partner Name"},
        }
        with self.assertRaisesRegex(ValueError, "Row 2: Unknown programme stage"):
            build_payload(rows)

    def test_known_qualifiers_and_governorate_aliases(self):
        self.assertEqual(normalize_stage("  go TO market / Investment Readiness  "), "Go to Market")
        self.assertEqual(normalize_stage("Acceleration / Biban"), "Acceleration")
        self.assertEqual(normalize_governorate("Jerash"), "Jarash")
        self.assertEqual(normalize_governorate("Ma'an"), "Maan")
        self.assertEqual(normalize_governorate("Ajloun"), "Ajlun")


if __name__ == "__main__":
    unittest.main()
