"""Build aggregate-only /map data from the reviewed support-measures table.

Usage: python3 scripts/prepare_map_dashboard_data.py 'Map Data.xlsx'
Only counts and source provenance are written to the frontend bundle. The source
workbook's existing Git tracking needs separate repository-exposure review.
"""

from __future__ import annotations

from collections import Counter
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from pathlib import Path
from sys import argv
from xml.etree import ElementTree
from zipfile import ZipFile
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend/src/data/mapSnapshot.json"
SOURCE_SHEET = "DATA - Support Measures"
VISIBLE_SHEET = "Map master (LENA)"
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
SOURCE_HEADERS = {"B": "Women-led", "C": "Governorate", "D": "Economic Sector", "E": "Staff Delta"}
VISIBLE_HEADERS = {
    3: {"A": "Governorate", "B": "Total start-ups", "F": "employed", "G": "Economic sector"},
    4: {"C": "Male", "D": "Female"},
}
GOVERNORATES = {
    "aqaba": "Aqaba", "karak": "Karak", "mafraq": "Mafraq", "jarash": "Jarash",
    "amman": "Amman", "ajlun": "Ajloun", "irbid": "Irbid", "maan": "Ma'an",
    "balqa": "Balqa", "madaba": "Madaba", "tafilah": "Tafilah", "zarqa": "Zarqa",
}
GOVERNORATE_ALIASES = {
    "aqaba": "aqaba", "karak": "karak", "al-karak": "karak", "mafraq": "mafraq",
    "jarash": "jarash", "jerash": "jarash", "amman": "amman",
    "ajlun": "ajlun", "ajloun": "ajlun", "irbid": "irbid",
    "maan": "maan", "ma'an": "maan", "balqa": "balqa", "madaba": "madaba",
    "tafilah": "tafilah", "at-tafilah": "tafilah", "zarqa": "zarqa",
}
SECTOR_GROUPS = (
    "technologyDigital", "greenCleanTech", "industryManufacturing",
    "healthSocialImpact", "educationCreative", "commerceServices",
    "hospitalityTourism", "other",
)
# Reviewed source labels, including one punctuation variant of the same water-supply label.
SECTOR_SOURCE_GROUPS = {
    "information and communication": "technologyDigital",
    "agriculture, forestry and fishing": "greenCleanTech",
    "water supply; sewerage, waste management and remediation activities": "greenCleanTech",
    "water supply, sewerage, waste management and remediation activities": "greenCleanTech",
    "manufacturing": "industryManufacturing",
    "construction": "industryManufacturing",
    "human health and social work activities": "healthSocialImpact",
    "education": "educationCreative",
    "arts, entertainment and recreation": "educationCreative",
    "administrative and support service activities": "commerceServices",
    "wholesale and retail trade; repair of motor vehicles and motorcycles": "commerceServices",
    "professional, scientific and technical activities": "commerceServices",
    "financial and insurance activities": "commerceServices",
    "transportation and storage": "commerceServices",
    "real estate activities": "commerceServices",
    "accommodation and food service activities": "hospitalityTourism",
}
# Reviewed gaps remain Other pending source correction or an approved taxonomy.
UNCLASSIFIED_SECTOR_LABELS = {
    "", "-", "agriculture", "agritech",
    "electricity, gas, steam and air conditioning supply",
    "public administration and defense; compulsory social security",
}


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold().replace("’", "'")


def normalize_governorate(value: str) -> str:
    key = normalize_text(value)
    if key not in GOVERNORATE_ALIASES:
        raise ValueError(f"Unknown governorate: {value!r}")
    return GOVERNORATE_ALIASES[key]


def normalize_sector(value: str) -> str:
    key = normalize_text(value)
    if key in UNCLASSIFIED_SECTOR_LABELS:
        return "other"
    if key not in SECTOR_SOURCE_GROUPS:
        raise ValueError(f"Unmapped economic sector: {value!r}")
    return SECTOR_SOURCE_GROUPS[key]


def _sheet_path(archive: ZipFile, sheet_name: str) -> str:
    workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
    relationships = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.attrib["Id"]: rel.attrib["Target"]
               for rel in relationships.findall(f"{{{PACKAGE_NS}}}Relationship")}
    for sheet in workbook.findall(f".//{{{MAIN_NS}}}sheet"):
        if sheet.attrib.get("name") == sheet_name:
            target = targets[sheet.attrib[f"{{{REL_NS}}}id"]]
            return target.lstrip("/") if target.startswith("/") else "xl/" + target
    raise ValueError(f"Worksheet {sheet_name!r} is missing")


def read_rows(path: Path, sheet_name: str = SOURCE_SHEET) -> dict[int, dict[str, str]]:
    """Read cached cell values from one named sheet without copying private data."""
    columns = set(SOURCE_HEADERS if sheet_name == SOURCE_SHEET else "ABCDEFG")
    with ZipFile(path) as archive:
        if "xl/sharedStrings.xml" in archive.namelist():
            strings_root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            strings = ["".join(node.text or "" for node in item.findall(f".//{{{MAIN_NS}}}t"))
                       for item in strings_root.findall(f"{{{MAIN_NS}}}si")]
        else:
            strings = []
        sheet = ElementTree.fromstring(archive.read(_sheet_path(archive, sheet_name)))
    rows: dict[int, dict[str, str]] = {}
    for row in sheet.findall(f".//{{{MAIN_NS}}}sheetData/{{{MAIN_NS}}}row"):
        values: dict[str, str] = {}
        for cell in row.findall(f"{{{MAIN_NS}}}c"):
            match = re.match(r"[A-Z]+", cell.attrib["r"])
            if match is None:
                raise ValueError("Invalid spreadsheet cell reference")
            column = match.group()
            if column not in columns:
                continue
            raw = cell.find(f"{{{MAIN_NS}}}v")
            inline = cell.find(f"{{{MAIN_NS}}}is")
            if raw is not None:
                value = strings[int(raw.text or "0")] if cell.attrib.get("t") == "s" else (raw.text or "")
            elif inline is not None:
                value = "".join(node.text or "" for node in inline.findall(f".//{{{MAIN_NS}}}t"))
            else:
                value = ""
            values[column] = value
        rows[int(row.attrib["r"])] = values
    return rows


def parse_employees(value: str, row_number: int) -> int:
    if not value.strip():
        raise ValueError(f"Row {row_number}: Staff Delta is missing")
    try:
        number = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"Row {row_number}: Staff Delta is not numeric") from error
    if not number.is_finite() or number < 0 or number != number.to_integral_value():
        raise ValueError(f"Row {row_number}: Staff Delta must be a nonnegative integer")
    return int(number)


def empty_summary() -> dict:
    return {
        "total": 0,
        "gender": {"female": 0, "male": 0, "unknown": 0},
        "employment": {"startupsWithEmployees": 0, "totalEmployees": 0, "unknownCount": 0},
        "sectors": {sector: 0 for sector in SECTOR_GROUPS},
    }


def _check_summary(summary: dict) -> None:
    total = summary["total"]
    if (sum(summary["gender"].values()) != total or
            sum(summary["sectors"].values()) != total or
            summary["employment"]["startupsWithEmployees"] > total):
        raise ValueError("Map aggregates do not reconcile")


def _data_row_numbers(rows: dict[int, dict[str, str]]) -> list[int]:
    numbers = sorted(number for number, row in rows.items()
                     if number >= 5 and any(row.get(column, "").strip() for column in SOURCE_HEADERS))
    if not numbers or numbers != list(range(5, numbers[-1] + 1)):
        raise ValueError("Support-measures data rows are empty or have a gap")
    return numbers


def _check_visible_rows(source_rows: dict[int, dict[str, str]],
                        visible_rows: dict[int, dict[str, str]], numbers: list[int]) -> None:
    for row_number, headers in VISIBLE_HEADERS.items():
        if any(visible_rows.get(row_number, {}).get(column) != title for column, title in headers.items()):
            raise ValueError("Visible map sheet headers differ from the reviewed source")
    if sorted(number for number, row in visible_rows.items()
              if number >= 5 and row.get("A", "").strip()) != numbers:
        raise ValueError("Visible map sheet row count differs from support measures")
    for number in numbers:
        source = source_rows[number]
        visible = visible_rows[number]
        female = int(source["B"])
        expected = {
            "A": source["C"], "B": "1", "C": str(1 - female), "D": str(female),
            "E": str(female), "F": source["E"], "G": source.get("D", "") or "0",
        }
        if any(visible.get(column, "") != value for column, value in expected.items()):
            raise ValueError(f"Row {number}: visible map values disagree with source table")


def build_snapshot(source_rows: dict[int, dict[str, str]], visible_rows: dict[int, dict[str, str]],
                   workbook_name: str, digest: str) -> dict:
    if any(source_rows.get(4, {}).get(column) != title for column, title in SOURCE_HEADERS.items()):
        raise ValueError("Support-measures headers differ from the reviewed source")
    numbers = _data_row_numbers(source_rows)
    nationwide = empty_summary()
    governors: dict[str, dict] = {}
    unclassified: Counter[str] = Counter()
    for number in numbers:
        row = source_rows[number]
        gender_value = row.get("B", "").strip()
        if gender_value not in ("0", "1"):
            raise ValueError(f"Row {number}: Women-led must be 0 or 1")
        governorate = normalize_governorate(row.get("C", ""))
        sector_label = row.get("D", "").strip()
        sector = normalize_sector(sector_label)
        employees = parse_employees(row.get("E", ""), number)
        if sector == "other":
            unclassified[sector_label or "(blank)"] += 1
        for summary in (nationwide, governors.setdefault(governorate, empty_summary())):
            summary["total"] += 1
            summary["gender"]["female" if gender_value == "1" else "male"] += 1
            summary["sectors"][sector] += 1
            summary["employment"]["startupsWithEmployees"] += int(employees > 0)
            summary["employment"]["totalEmployees"] += employees

    _check_visible_rows(source_rows, visible_rows, numbers)
    _check_summary(nationwide)
    for summary in governors.values():
        _check_summary(summary)
    if sum(summary["total"] for summary in governors.values()) != nationwide["total"]:
        raise ValueError("Governorate totals do not reconcile")
    if sum(unclassified.values()) != nationwide["sectors"]["other"]:
        raise ValueError("Unclassified sector audit does not reconcile")

    return {
        "schemaVersion": 3,
        "source": {
            "workbook": workbook_name,
            "sheet": SOURCE_SHEET,
            "sha256": digest,
            "sourceRecordCount": len(numbers),
            "includedCount": nationwide["total"],
            "uniquenessBasis": "owner-confirmed-one-row-per-startup",
            "genderField": "Women-led",
            "employmentField": "Staff Delta",
            "unclassifiedSectorCount": sum(unclassified.values()),
            "unclassifiedSectorLabels": dict(sorted(unclassified.items())),
        },
        "nationwide": {**nationwide, "representedGovernorates": len(governors)},
        "governorates": {
            identifier: {"name": GOVERNORATES[identifier], **governors[identifier]}
            for identifier in GOVERNORATES if identifier in governors
        },
    }


def main(path: Path) -> None:
    if not path.is_file():
        raise SystemExit(f"Workbook does not exist: {path}")
    snapshot = build_snapshot(
        read_rows(path), read_rows(path, VISIBLE_SHEET), path.name, sha256(path.read_bytes()).hexdigest()
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {snapshot['nationwide']['total']} aggregate startup rows across "
          f"{snapshot['nationwide']['representedGovernorates']} governorates")
    print(f"Wrote aggregate-only data: {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(argv) != 2:
        raise SystemExit("Usage: python3 scripts/prepare_map_dashboard_data.py 'Map Data.xlsx'")
    main(Path(argv[1]))
