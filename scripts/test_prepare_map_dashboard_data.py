"""Synthetic import checks and an optional read-only source-workbook audit."""

from hashlib import sha256
from os import environ
from pathlib import Path
import unittest

from prepare_map_dashboard_data import (
    HEADERS, build_snapshot, normalize_governorate, normalize_sector, read_rows,
)


def synthetic_rows():
    first = {
        "A": "E4DE-1", "C": "Synthetic A", "D": "Ajlun", "E": "Acceleration",
        "F": "IT soluations", "G": "Female", "J": "", "O": "3", "X": "0",
    }
    second = {
        "A": "E4DE-2", "C": "Synthetic B", "D": "Al-Karak", "E": "Go to Market",
        "F": "Professional, scientific and technical activities", "G": "Male",
        "J": "", "O": "0", "X": "Employees count missing",
    }
    return {1: HEADERS.copy(), 2: first, 3: second, 4: first.copy(),
            5: {"A": "NA", "C": "Excluded", "E": "NA", "J": "ICON Beneficiry"}}


class MapDashboardDataTests(unittest.TestCase):
    def test_synthetic_filter_deduplication_and_unknown_employment(self):
        snapshot = build_snapshot(synthetic_rows(), "synthetic.xlsx", "synthetic-digest")
        self.assertEqual(snapshot["nationwide"]["total"], 2)
        self.assertEqual(snapshot["nationwide"]["gender"], {"female": 1, "male": 1, "unknown": 0})
        self.assertEqual(snapshot["nationwide"]["employment"], {
            "startupsWithEmployees": 1, "totalEmployees": 3, "unknownCount": 1,
        })
        self.assertEqual(snapshot["nationwide"]["sectors"]["technologyDigital"], 1)
        self.assertEqual(snapshot["nationwide"]["sectors"]["commerceServices"], 1)
        self.assertEqual(snapshot["governorates"]["ajlun"]["name"], "Ajloun")
        self.assertEqual(snapshot["source"]["sourceRecordCount"], 4)
        self.assertEqual(snapshot["source"]["deduplicatedRowCount"], 1)
        self.assertEqual(snapshot["source"]["excludedIconNAStageCount"], 1)

    def test_normalization_and_unmapped_sector(self):
        self.assertEqual(normalize_governorate(" Ma’an "), "maan")
        self.assertEqual(normalize_governorate("Jerash"), "jarash")
        self.assertEqual(normalize_sector("  DAIRY   PRODUCTION "), "industryManufacturing")
        self.assertEqual(normalize_sector("cosmetics"), "other")
        self.assertEqual(normalize_sector("  "), "other")
        with self.assertRaisesRegex(ValueError, "Unmapped economic sector"):
            normalize_sector("a newly introduced category")

    def test_conflicting_duplicate_and_invalid_employment_fail(self):
        rows = synthetic_rows()
        rows[4]["O"] = "4"
        with self.assertRaisesRegex(ValueError, "conflicting duplicate E4DE code"):
            build_snapshot(rows, "synthetic.xlsx", "synthetic-digest")
        rows = synthetic_rows()
        rows[2]["O"] = "-1"
        rows[4]["O"] = "-1"
        with self.assertRaisesRegex(ValueError, "Employees must be a nonnegative integer"):
            build_snapshot(rows, "synthetic.xlsx", "synthetic-digest")

    def test_reviewed_workbook_aggregates_when_available(self):
        source = environ.get("MAP_WORKBOOK_PATH")
        if not source:
            self.skipTest("MAP_WORKBOOK_PATH was not provided")
        path = Path(source)
        snapshot = build_snapshot(read_rows(path), path.name, sha256(path.read_bytes()).hexdigest())
        nationwide = snapshot["nationwide"]
        self.assertEqual(nationwide["total"], 265)
        self.assertEqual(nationwide["representedGovernorates"], 8)
        self.assertEqual(nationwide["stages"], {
            "Acceleration": 150, "Go to Market": 91, "Grow+": 24,
        })
        self.assertEqual(nationwide["gender"], {"female": 142, "male": 123, "unknown": 0})
        self.assertEqual(nationwide["employment"], {
            "startupsWithEmployees": 142, "totalEmployees": 762, "unknownCount": 2,
        })
        self.assertEqual(sum(nationwide["sectors"].values()), 265)
        self.assertEqual(sum(item["total"] for item in snapshot["governorates"].values()), 265)
        self.assertEqual(snapshot["source"]["excludedIconNAStageCount"], 15)
        self.assertEqual(snapshot["source"]["excludedNAStageCount"], 124)
        self.assertEqual(snapshot["governorates"]["aqaba"]["total"], 84)
        self.assertEqual(snapshot["governorates"]["amman"]["total"], 22)
        self.assertEqual(snapshot["governorates"]["ajlun"]["total"], 14)
        self.assertEqual(snapshot["governorates"]["ajlun"]["gender"], {
            "female": 9, "male": 5, "unknown": 0,
        })
        self.assertEqual(snapshot["governorates"]["ajlun"]["employment"], {
            "startupsWithEmployees": 9, "totalEmployees": 35, "unknownCount": 0,
        })


if __name__ == "__main__":
    unittest.main()
