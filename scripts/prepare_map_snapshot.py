"""Prepare an aggregate-only SQL seed from the supplied startup workbook.

Usage: python3 scripts/prepare_map_snapshot.py 'Participants List.xlsx'
The source workbook stays local because it contains personal contact information.
"""

from collections import Counter
from hashlib import sha256
from pathlib import Path
from sys import argv
from xml.etree import ElementTree
from zipfile import ZipFile
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "supabase/seed/map_dashboard_snapshot.sql"
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
STAGES = ("Acceleration", "Grow+", "Go to Market")
GOVERNORATES = ("Aqaba", "Karak", "Mafraq", "Jarash", "Amman", "Ajlun", "Irbid", "Maan")
EXPECTED = {
    "Aqaba": (44, 4, 36), "Karak": (45, 1, 0), "Mafraq": (21, 1, 22),
    "Jarash": (13, 2, 23), "Amman": (0, 15, 8), "Ajlun": (14, 0, 0),
    "Irbid": (13, 1, 0), "Maan": (0, 0, 3),
}
ALIASES = {
    "aqaba": "Aqaba", "karak": "Karak", "mafraq": "Mafraq",
    "jarash": "Jarash", "jerash": "Jarash", "amman": "Amman",
    "ajlun": "Ajlun", "ajloun": "Ajlun", "irbid": "Irbid",
    "maan": "Maan", "ma'an": "Maan", "ma’an": "Maan",
}
QUALIFIERS = {
    "acceleration": {"", "biban"},
    "grow+": {"", "investment readiness"},
    "go to market": {"", "investment readiness", "waic"},
}


def normalize_stage(value: str) -> str:
    parts = [re.sub(r"\s+", " ", part.strip()).casefold() for part in value.split("/")]
    if len(parts) > 2 or not parts or parts[0] not in QUALIFIERS:
        raise ValueError(f"Unknown programme stage: {value!r}")
    qualifier = parts[1] if len(parts) == 2 else ""
    if qualifier not in QUALIFIERS[parts[0]]:
        raise ValueError(f"Unknown programme stage: {value!r}")
    return {"acceleration": "Acceleration", "grow+": "Grow+", "go to market": "Go to Market"}[parts[0]]


def normalize_governorate(value: str) -> str:
    key = re.sub(r"\s+", " ", value.strip()).casefold()
    if key not in ALIASES:
        raise ValueError(f"Unknown governorate: {value!r}")
    return ALIASES[key]


def read_rows(path: Path) -> dict[int, dict[str, str]]:
    with ZipFile(path) as archive:
        strings_root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
        strings = ["".join(node.text or "" for node in item.findall(".//x:t", NS))
                   for item in strings_root.findall("x:si", NS)]
        sheet = ElementTree.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    rows: dict[int, dict[str, str]] = {}
    for row in sheet.findall(".//x:sheetData/x:row", NS):
        values: dict[str, str] = {}
        for cell in row.findall("x:c", NS):
            column = re.match(r"[A-Z]+", cell.attrib["r"])
            assert column is not None
            raw = cell.find("x:v", NS)
            inline = cell.find("x:is", NS)
            if raw is not None:
                value = strings[int(raw.text)] if cell.attrib.get("t") == "s" else (raw.text or "")
            elif inline is not None:
                value = "".join(node.text or "" for node in inline.findall(".//x:t", NS))
            else:
                value = ""
            values[column.group()] = value
        rows[int(row.attrib["r"])] = values
    return rows


def build_payload(rows: dict[int, dict[str, str]]) -> dict:
    if [rows.get(1, {}).get(column) for column in ("A", "B", "F", "G")] != [
        "E4DE Code", "Startup Name", "Governorate", "Stage"
    ]:
        raise ValueError("Workbook headers differ from the reviewed source")
    if rows.get(270, {}).get("B") != "Partner Name":
        raise ValueError("Partner-directory boundary was not found at row 270")
    if any(any(value.strip() for value in rows.get(number, {}).values()) for number in (268, 269)):
        raise ValueError("Unexpected data between startups and partner directory")

    counts: Counter[tuple[str, str]] = Counter()
    missing_codes: list[str] = []
    for number in range(2, 268):
        row = rows.get(number, {})
        name = row.get("B", "").strip()
        if not name:
            raise ValueError(f"Missing startup name at row {number}")
        if not row.get("A", "").strip():
            missing_codes.append(name)
        try:
            governorate = normalize_governorate(row.get("F", ""))
            stage = normalize_stage(row.get("G", ""))
        except ValueError as error:
            raise ValueError(f"Row {number}: {error}") from error
        counts[governorate, stage] += 1
    if missing_codes != ["Rewaq"]:
        raise ValueError(f"Unexpected missing E4DE codes: {missing_codes}")

    governorates = {}
    for name in GOVERNORATES:
        values = tuple(counts[name, stage] for stage in STAGES)
        if values != EXPECTED[name]:
            raise ValueError(f"{name} counts differ: observed {values}, expected {EXPECTED[name]}")
        governorates[name.lower()] = {
            "name": name, "total": sum(values),
            "stages": dict(zip(STAGES, values)),
        }
    nationwide_stages = {stage: sum(counts[name, stage] for name in GOVERNORATES) for stage in STAGES}
    if nationwide_stages != {"Acceleration": 150, "Grow+": 24, "Go to Market": 92}:
        raise ValueError(f"Nationwide stages differ: {nationwide_stages}")
    if sum(item["total"] for item in governorates.values()) != 266:
        raise ValueError("Governorate totals do not reconcile to 266")
    return {
        "schemaVersion": 1,
        "nationwide": {"total": 266, "represented_governorates": 8, "stages": nationwide_stages},
        "governorates": governorates,
    }


def main(path: Path) -> None:
    payload = build_payload(read_rows(path))
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    sql_payload = serialized.replace("'", "''")
    digest = sha256(path.read_bytes()).hexdigest()
    sql = (
        "-- Aggregate-only seed prepared from Participants List.xlsx, rows 2-267.\n"
        f"-- Source SHA-256: {digest}\n"
        "-- Apply only after the map_dashboard_snapshots migration. No personal data is stored.\n"
        "insert into public.map_dashboard_snapshots (event_id, payload, source_record_count)\n"
        f"values (17135, '{sql_payload}'::jsonb, 266);\n"
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(sql, encoding="utf-8")
    print("Prepared 266 startups across 8 governorates: Acceleration 150, Grow+ 24, Go to Market 92")
    print(f"Wrote aggregate-only seed: {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(argv) != 2:
        raise SystemExit("Usage: python3 scripts/prepare_map_snapshot.py 'Participants List.xlsx'")
    main(Path(argv[1]))
