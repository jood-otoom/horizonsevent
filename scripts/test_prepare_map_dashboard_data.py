"""Synthetic importer checks and an optional read-only source-workbook audit."""

from hashlib import sha256
from os import environ
from pathlib import Path
import unittest

from prepare_map_dashboard_data import (
    SOURCE_HEADERS, VISIBLE_HEADERS, VISIBLE_SHEET, build_snapshot,
    normalize_governorate, normalize_sector, read_rows,
)


def synthetic_rows():
    source = {
        4: SOURCE_HEADERS.copy(),
        5: {"B": "1", "C": "Ajlun", "D": "Information and communication", "E": "3"},
        6: {"B": "0", "C": "Al-Karak", "D": "-", "E": "0"},
    }
    visible = {number: headers.copy() for number, headers in VISIBLE_HEADERS.items()}
    visible[5] = {
        "A": "Ajlun", "B": "1", "C": "0", "D": "1", "E": "1",
        "F": "3", "G": "Information and communication",
    }
    visible[6] = {
        "A": "Al-Karak", "B": "1", "C": "1", "D": "0", "E": "0",
        "F": "0", "G": "-",
    }
    return source, visible


class MapDashboardDataTests(unittest.TestCase):
    def test_synthetic_rows_and_unclassified_sector_reconcile(self):
        source, visible = synthetic_rows()
        snapshot = build_snapshot(source, visible, "synthetic.xlsx", "synthetic-digest")
        self.assertEqual(snapshot["schemaVersion"], 3)
        self.assertEqual(snapshot["nationwide"]["total"], 2)
        self.assertEqual(snapshot["nationwide"]["gender"], {"female": 1, "male": 1, "unknown": 0})
        self.assertEqual(snapshot["nationwide"]["employment"], {
            "startupsWithEmployees": 1, "totalEmployees": 3, "unknownCount": 0,
        })
        self.assertEqual(snapshot["nationwide"]["sectors"]["technologyDigital"], 1)
        self.assertEqual(snapshot["nationwide"]["sectors"]["other"], 1)
        self.assertEqual(snapshot["source"]["unclassifiedSectorLabels"], {"-": 1})
        self.assertEqual(snapshot["source"]["uniquenessBasis"], "owner-confirmed-one-row-per-startup")
        self.assertEqual(snapshot["source"]["genderField"], "Women-led")
        self.assertEqual(snapshot["source"]["employmentField"], "Staff Delta")
        self.assertEqual(snapshot["governorates"]["ajlun"]["name"], "Ajloun")

    def test_rows_with_identical_attributes_remain_distinct(self):
        source, visible = synthetic_rows()
        source[6] = source[5].copy()
        visible[6] = visible[5].copy()
        snapshot = build_snapshot(source, visible, "synthetic.xlsx", "synthetic-digest")
        self.assertEqual(snapshot["nationwide"]["total"], 2)
        self.assertEqual(snapshot["governorates"]["ajlun"]["total"], 2)
        self.assertEqual(snapshot["nationwide"]["employment"]["totalEmployees"], 6)

    def test_normalization_and_unmapped_sector(self):
        self.assertEqual(normalize_governorate(" Ma’an "), "maan")
        self.assertEqual(normalize_governorate("Jerash"), "jarash")
        self.assertEqual(normalize_governorate("At-Tafilah"), "tafilah")
        self.assertEqual(normalize_sector(
            "Water supply, Sewerage, Waste Management and Remediation Activities"
        ), "greenCleanTech")
        self.assertEqual(normalize_sector("Agritech"), "other")
        self.assertEqual(normalize_sector("  "), "other")
        with self.assertRaisesRegex(ValueError, "Unmapped economic sector"):
            normalize_sector("a newly introduced category")

    def test_invalid_gender_and_employment_fail(self):
        source, visible = synthetic_rows()
        source[5]["B"] = "2"
        with self.assertRaisesRegex(ValueError, "Women-led must be 0 or 1"):
            build_snapshot(source, visible, "synthetic.xlsx", "synthetic-digest")
        source, visible = synthetic_rows()
        source[5]["E"] = "-1"
        with self.assertRaisesRegex(ValueError, "Staff Delta must be a nonnegative integer"):
            build_snapshot(source, visible, "synthetic.xlsx", "synthetic-digest")
        source, visible = synthetic_rows()
        source[5]["E"] = ""
        with self.assertRaisesRegex(ValueError, "Staff Delta is missing"):
            build_snapshot(source, visible, "synthetic.xlsx", "synthetic-digest")

    def test_source_and_visible_rows_must_reconcile(self):
        source, visible = synthetic_rows()
        visible[5]["F"] = "4"
        with self.assertRaisesRegex(ValueError, "visible map values disagree"):
            build_snapshot(source, visible, "synthetic.xlsx", "synthetic-digest")
        source, visible = synthetic_rows()
        del source[5]
        with self.assertRaisesRegex(ValueError, "have a gap"):
            build_snapshot(source, visible, "synthetic.xlsx", "synthetic-digest")

    def test_reviewed_workbook_aggregates_when_available(self):
        path_text = environ.get("MAP_WORKBOOK_PATH")
        if not path_text:
            self.skipTest("MAP_WORKBOOK_PATH was not provided")
        path = Path(path_text)
        snapshot = build_snapshot(
            read_rows(path), read_rows(path, VISIBLE_SHEET),
            path.name, sha256(path.read_bytes()).hexdigest(),
        )
        nationwide = snapshot["nationwide"]
        self.assertEqual(nationwide["total"], 666)
        self.assertEqual(nationwide["representedGovernorates"], 12)
        self.assertEqual(nationwide["gender"], {"female": 427, "male": 239, "unknown": 0})
        self.assertEqual(nationwide["employment"], {
            "startupsWithEmployees": 192, "totalEmployees": 628, "unknownCount": 0,
        })
        self.assertEqual(nationwide["sectors"], {
            "technologyDigital": 42, "greenCleanTech": 87,
            "industryManufacturing": 205, "healthSocialImpact": 48,
            "educationCreative": 131, "commerceServices": 95,
            "hospitalityTourism": 36, "other": 22,
        })
        self.assertEqual(snapshot["source"]["sourceRecordCount"], 666)
        self.assertEqual(snapshot["source"]["unclassifiedSectorCount"], 22)
        self.assertEqual(snapshot["source"]["unclassifiedSectorLabels"], {
            "(blank)": 16, "-": 1, "Agriculture": 1, "Agritech": 1,
            "Electricity, gas, steam and air conditioning supply": 2,
            "Public administration and defense; compulsory social security": 1,
        })
        expected_governorates = {
            "aqaba": 148, "karak": 101, "mafraq": 125, "jarash": 88,
            "amman": 80, "ajlun": 18, "irbid": 62, "maan": 15,
            "balqa": 4, "madaba": 1, "tafilah": 19, "zarqa": 5,
        }
        self.assertEqual({key: value["total"] for key, value in snapshot["governorates"].items()},
                         expected_governorates)
        self.assertEqual(sum(expected_governorates.values()), nationwide["total"])


if __name__ == "__main__":
    unittest.main()
