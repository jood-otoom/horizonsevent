"""Build the public, aggregate-only /map dataset from the private Map master sheet.

Usage: python3 scripts/prepare_map_dashboard_data.py '/path/to/Map Master - E4DE v2.xlsx'
The source workbook is read locally and is never copied into the frontend.
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
MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
STAGES = ("Acceleration", "Go to Market", "Grow+")
GOVERNORATES = {
    "aqaba": "Aqaba", "karak": "Karak", "mafraq": "Mafraq", "jarash": "Jarash",
    "amman": "Amman", "ajlun": "Ajloun", "irbid": "Irbid", "maan": "Ma'an",
}
GOVERNORATE_ALIASES = {
    "aqaba": "aqaba", "karak": "karak", "al-karak": "karak", "mafraq": "mafraq",
    "jarash": "jarash", "jerash": "jarash", "amman": "amman",
    "ajlun": "ajlun", "ajloun": "ajlun", "irbid": "irbid",
    "maan": "maan", "ma'an": "maan",
}
SECTOR_GROUPS = (
    "technologyDigital", "greenCleanTech", "industryManufacturing",
    "healthSocialImpact", "educationCreative", "commerceServices",
    "hospitalityTourism", "other",
)
# Each workbook label has one explicit presentation group. New labels fail review.
SECTOR_SOURCE_GROUPS = {
    "information and communication": "technologyDigital",
    "it solutions": "technologyDigital",
    "it soluations": "technologyDigital",  # Spelling in the reviewed source.
    "agriculture, forestry and fishing": "greenCleanTech",
    "water supply; sewerage, waste management and remediation activities": "greenCleanTech",
    "manufacturing": "industryManufacturing",
    "dairy production": "industryManufacturing",
    "construction": "industryManufacturing",
    "human health and social work activities": "healthSocialImpact",
    "health technology": "healthSocialImpact",
    "education": "educationCreative",
    "arts, entertainment and recreation": "educationCreative",
    "administrative and support service activities": "commerceServices",
    "wholesale and retail trade; repair of motor vehicles and motorcycles": "commerceServices",
    "professional, scientific and technical activities": "commerceServices",
    "financial and insurance activities": "commerceServices",
    "transportation and storage": "commerceServices",
    "real estate activities": "commerceServices",
    "accommodation and food service activities": "hospitalityTourism",
    "cosmetics": "other",
    "uncategorized": "other",
}
WARNING_KEYS = {
    "total female exceeds total employment": "totalFemaleExceedsTotalEmployment",
    "total age 18–25 exceeds total employment": "totalYouthExceedsTotalEmployment",
    "total refugee exceeds total employment": "totalRefugeeExceedsTotalEmployment",
    "economic sector missing": "economicSectorMissingReviewFlag",
    "employees count missing": "employeesCountMissing",
    "endline survey marked not yet": "endlineSurveyNotYet",
}
HEADERS = {
    "A": "E4DE code", "C": "Startup name", "D": "Governorate",
    "E": "Programme stage", "F": "Economic sector", "G": "Participant gender",
    "O": "Employees", "S": "Total current employment", "X": "Data quality / review",
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
    if not key:
        return "other"
    if key not in SECTOR_SOURCE_GROUPS:
        raise ValueError(f"Unmapped economic sector: {value!r}")
    return SECTOR_SOURCE_GROUPS[key]


def _sheet_path(archive: ZipFile, sheet_name: str) -> str:
    workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
    relationships = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in relationships.findall(f"{{{PACKAGE_NS}}}Relationship")}
    for sheet in workbook.findall(f".//{{{MAIN_NS}}}sheet"):
        if sheet.attrib.get("name") == sheet_name:
            target = targets[sheet.attrib[f"{{{REL_NS}}}id"]]
            return target.lstrip("/") if target.startswith("/") else "xl/" + target
    raise ValueError(f"Worksheet {sheet_name!r} is missing")


def read_rows(path: Path) -> dict[int, dict[str, str]]:
    """Read only cached cell values from a named worksheet, without importing PII."""
    with ZipFile(path) as archive:
        if "xl/sharedStrings.xml" in archive.namelist():
            strings_root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            strings = ["".join(node.text or "" for node in item.findall(f".//{{{MAIN_NS}}}t"))
                       for item in strings_root.findall(f"{{{MAIN_NS}}}si")]
        else:
            strings = []
        sheet = ElementTree.fromstring(archive.read(_sheet_path(archive, "Map master")))
    rows: dict[int, dict[str, str]] = {}
    for row in sheet.findall(f".//{{{MAIN_NS}}}sheetData/{{{MAIN_NS}}}row"):
        values: dict[str, str] = {}
        for cell in row.findall(f"{{{MAIN_NS}}}c"):
            match = re.match(r"[A-Z]+", cell.attrib["r"])
            if match is None:
                raise ValueError("Invalid spreadsheet cell reference")
            column = match.group()
            if column not in HEADERS and column != "J":
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


def parse_employees(value: str, missing_flag: bool, row_number: int) -> int | None:
    if not value.strip():
        return None
    try:
        number = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"Row {row_number}: Employees is not numeric") from error
    if not number.is_finite() or number < 0 or number != number.to_integral_value():
        raise ValueError(f"Row {row_number}: Employees must be a nonnegative integer")
    if missing_flag:
        if number != 0:
            raise ValueError(f"Row {row_number}: Employees conflicts with missing-count review flag")
        return None
    return int(number)


def empty_summary() -> dict:
    return {
        "total": 0,
        "gender": {"female": 0, "male": 0, "unknown": 0},
        "employment": {"startupsWithEmployees": 0, "totalEmployees": 0, "unknownCount": 0},
        "stages": {stage: 0 for stage in STAGES},
        "sectors": {sector: 0 for sector in SECTOR_GROUPS},
    }


def _check_summary(summary: dict) -> None:
    total = summary["total"]
    if (sum(summary["gender"].values()) != total or
            sum(summary["stages"].values()) != total or
            sum(summary["sectors"].values()) != total or
            summary["employment"]["startupsWithEmployees"] + summary["employment"]["unknownCount"] > total):
        raise ValueError("Map aggregates do not reconcile")


def build_snapshot(rows: dict[int, dict[str, str]], workbook_name: str, digest: str) -> dict:
    if any(rows.get(1, {}).get(column) != title for column, title in HEADERS.items()):
        raise ValueError("Map master headers differ from the reviewed source")

    records: dict[str, tuple[int, tuple[str, ...]]] = {}
    duplicate_count = 0
    source_count = excluded_na = excluded_icon_na = excluded_missing_stage = 0
    for row_number, row in sorted(rows.items()):
        if row_number == 1:
            continue
        code = row.get("A", "").strip()
        has_source_data = code or row.get("C", "").strip() or row.get("E", "").strip()
        if not has_source_data:
            continue
        source_count += 1
        stage_key = normalize_text(row.get("E", ""))
        if stage_key == "na":
            excluded_na += 1
            if normalize_text(row.get("J", "")) in ("icon beneficiry", "icon beneficiary"):
                excluded_icon_na += 1
            continue
        if not stage_key:
            excluded_missing_stage += 1
            continue
        if stage_key not in (normalize_text(stage) for stage in STAGES):
            raise ValueError(f"Row {row_number}: unexpected programme stage")
        if not code or normalize_text(code) == "na":
            raise ValueError(f"Row {row_number}: E4DE code is missing")
        key = normalize_text(code)
        fields = tuple(row.get(column, "").strip() for column in ("C", "D", "E", "F", "G", "J", "O", "X"))
        if key in records:
            if records[key][1] != fields:
                raise ValueError(f"Row {row_number}: conflicting duplicate E4DE code")
            duplicate_count += 1
        else:
            records[key] = (row_number, fields)

    nationwide = empty_summary()
    governors: dict[str, dict] = {}
    warning_rows = 0
    warnings: Counter[str] = Counter()
    sector_review_conflicts = missing_sector_count = 0
    for row_number, fields in records.values():
        name, governorate, raw_stage, sector, gender, _icon_status, employee_value, review = fields
        stage = next((item for item in STAGES if normalize_text(item) == normalize_text(raw_stage)), None)
        if stage is None:
            raise ValueError("Unexpected programme stage in Map master")
        if not name:
            raise ValueError("Eligible startup has no name")
        governorate_id = normalize_governorate(governorate)
        sector_id = normalize_sector(sector)
        missing_sector_count += int(not sector.strip())
        gender_key = normalize_text(gender)
        if gender_key not in ("female", "male", "", "na"):
            raise ValueError("Unexpected participant gender in Map master")
        gender_id = gender_key if gender_key in ("female", "male") else "unknown"

        warning_keys: set[str] = set()
        for item in review.split(";"):
            label = normalize_text(item)
            if not label or label in ("na", "0"):
                continue
            if label not in WARNING_KEYS:
                raise ValueError("Unknown data-quality review warning in Map master")
            warning_keys.add(WARNING_KEYS[label])
        if warning_keys:
            warning_rows += 1
            warnings.update(warning_keys)
        if "economicSectorMissingReviewFlag" in warning_keys and sector.strip():
            sector_review_conflicts += 1
        employees = parse_employees(employee_value, "employeesCountMissing" in warning_keys, row_number)

        for summary in (nationwide, governors.setdefault(governorate_id, empty_summary())):
            summary["total"] += 1
            summary["gender"][gender_id] += 1
            summary["stages"][stage] += 1
            summary["sectors"][sector_id] += 1
            if employees is None:
                summary["employment"]["unknownCount"] += 1
            else:
                summary["employment"]["totalEmployees"] += employees
                summary["employment"]["startupsWithEmployees"] += int(employees > 0)

    _check_summary(nationwide)
    for summary in governors.values():
        _check_summary(summary)
    if sum(summary["total"] for summary in governors.values()) != nationwide["total"]:
        raise ValueError("Governorate totals do not reconcile")
    if source_count != nationwide["total"] + excluded_na + excluded_missing_stage + duplicate_count:
        raise ValueError("Source-row counts do not reconcile")
    if not nationwide["total"]:
        raise ValueError("Map master has no eligible startup records")

    return {
        "schemaVersion": 2,
        "source": {
            "workbook": workbook_name,
            "sheet": "Map master",
            "sha256": digest,
            "sourceRecordCount": source_count,
            "includedCount": nationwide["total"],
            "excludedNAStageCount": excluded_na,
            "excludedIconNAStageCount": excluded_icon_na,
            "excludedMissingStageCount": excluded_missing_stage,
            "deduplicatedRowCount": duplicate_count,
            "qualityWarnings": {
                "flaggedRecordCount": warning_rows,
                "byReason": {key: warnings[key] for key in WARNING_KEYS.values()},
                "sectorMissingFlagWithCategoryCount": sector_review_conflicts,
                "missingSectorValueCount": missing_sector_count,
            },
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
    snapshot = build_snapshot(read_rows(path), path.name, sha256(path.read_bytes()).hexdigest())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {snapshot['nationwide']['total']} aggregated startups across "
          f"{snapshot['nationwide']['representedGovernorates']} governorates")
    print(f"Wrote aggregate-only data: {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(argv) != 2:
        raise SystemExit("Usage: python3 scripts/prepare_map_dashboard_data.py '/path/to/Map Master workbook.xlsx'")
    main(Path(argv[1]))
