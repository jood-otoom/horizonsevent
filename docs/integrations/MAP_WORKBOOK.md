# Map workbook import

## Source and boundary

The local `/map` redesign is based on the supplied `Map Master - E4DE v2.xlsx`, SHA-256 `2fb7da63d61d8c2652f22968febec6c1da1bf354414eb2d8c54c26338e51cc68`. The user prompt names `v2(1).xlsx`, but that file was not present among the supplied paths. The available `v2.xlsx` has a `Map master` worksheet with 389 populated data rows. This document records what the import produced from those bytes; it does not claim that a later workbook revision has the same values.

The importer uses `Map master` only. It reads A (`E4DE code`) as the startup identifier, C (`Startup name`) only to check that an eligible record has an identity, D (`Governorate`), E (`Programme stage`), F (`Economic sector`), G (`Participant gender`), O (`Employees`), J (`ICON status`) for the exclusion audit, and X (`Data quality / review`). Column S (`Total current employment`) is a distinct measure and does not feed the displayed employment cards. The registration, support-measures, and event-participant worksheets do not feed this map. The generated JSON includes only counts, source provenance, and warning counts; it contains no code, startup name, contact, or participant-level record.

An eligible row has stage `Acceleration`, `Go to Market`, or `Grow+`. The importer excludes `NA` and blank stages, rejects unexpected nonblank stages, then deduplicates eligible rows by a nonblank E4DE code. Identical duplicate rows collapse; conflicting rows for one code stop generation. The current source has 265 unique eligible records, no eligible duplicates, 124 `NA`-stage rows, and no blank-stage rows. Of those 124 excluded rows, 15 carry the workbook's `ICON Beneficiry` status. The excluded `NA` rows use the placeholder code `NA`, so that code cannot identify unique startups and is not included in eligible deduplication. The importer checks that included, excluded, and collapsed row counts reconcile to the source count.

Governorate spellings are normalized by explicit aliases: Ajlun/Ajloun to `ajlun` displayed as Ajloun; Jarash/Jerash to `jarash` displayed as Jarash; Maan/Ma'an to `maan` displayed as Ma'an; Karak/Al-Karak to `karak` displayed as Karak. Other recognized labels are Aqaba, Mafraq, Amman, and Irbid. An unmapped eligible governorate stops generation for review rather than appearing under a guessed region.

## Sector mapping

The importer keeps one explicit source-label mapping in `SECTOR_SOURCE_GROUPS` in `scripts/prepare_map_dashboard_data.py`. It normalizes capitalization, whitespace, and apostrophe style, but does not infer category from words such as “technical.” A new nonblank source label stops generation until reviewed. A blank or explicit `Uncategorized` label goes to Other and the missing-value count is reported.

| Presentation group | Exact normalized source labels in this workbook or accepted spelling alias |
|---|---|
| Technology & Digital | Information and communication; IT soluations (workbook spelling); IT solutions |
| Green & Clean Tech | Agriculture, forestry and fishing; Water supply; sewerage, waste management and remediation activities |
| Industry & Manufacturing | Manufacturing; Dairy Production; Construction |
| Health & Social Impact | Human health and social work activities; Health technology |
| Education & Creative | Education; Arts, entertainment and recreation |
| Commerce & Services | Administrative and support service activities; Wholesale and retail trade; repair of motor vehicles and motorcycles; Professional, scientific and technical activities; Financial and insurance activities; Transportation and storage; Real estate activities |
| Hospitality & Tourism | Accommodation and food service activities |
| Other | cosmetics; Uncategorized; blank source label |

The resulting national group counts, in the table order, are 14, 31, 91, 13, 49, 45, 21, and 1. They sum to 265. Each eligible startup contributes to exactly one group. Card percentages derive from those counts using the currently selected governorate's total.

## Current reconciliation and quality limits

| Measure | Current imported count |
|---|---:|
| Eligible startups | 265 |
| Represented governorates | 8 |
| Acceleration / Go to Market / Grow+ | 150 / 91 / 24 |
| Female / Male / unknown participant gender | 142 / 123 / 0 |
| Startups with known positive `Employees` | 142 |
| Sum of known `Employees` | 762 |
| Employee counts marked unknown | 2 |

Governorate totals are Aqaba 84, Karak 46, Mafraq 44, Jarash 38, Amman 22, Ajloun 14, Irbid 14, and Ma'an 3; they sum to 265. Ajloun has 9 female and 5 male participants, 9 startups with known positive employees, 35 counted employees, and 14 Acceleration startups. Every national and governorate summary reconciles gender, stage, and sector categories to its total.

Column X flags 65 eligible rows with at least one review warning. Reason counts overlap: 48 `Total female exceeds total employment`, 39 `Total age 18–25 exceeds total employment`, 3 `Total refugee exceeds total employment`, 4 `Economic sector missing`, 2 `Employees count missing`, and 2 `Endline survey marked Not yet`. The four sector-missing flags coexist with filled F cells (`Dairy Production`, `IT soluations`, `Health technology`, `cosmetics`). The current map classifies those explicit F values and preserves the warning counts; it does not claim to resolve the underlying source conflict.

Both employee-missing flags are on Amman rows where cached O reads `0`. The importer treats those counts as unknown instead of verified zero, so national `unknownCount` is 2 and Amman `unknownCount` is 2. The 142 employing startups and 762 employees are sums of known O values and can be incomplete until those source warnings are resolved. Employee counts must otherwise be nonnegative integers. Gender is the workbook's **participant gender**, not verified startup leadership gender.

## Regeneration and review

Keep the private workbook outside the repository. The importer reads cached Excel cell values, including formula results; recalculate and save the workbook in a spreadsheet application after editing it, then inspect the revision before importing. From the repository root:

```sh
python3 scripts/prepare_map_dashboard_data.py '/path/to/Map Master - E4DE v2.xlsx'
MAP_WORKBOOK_PATH='/path/to/Map Master - E4DE v2.xlsx' python3 -m unittest discover -s scripts -p 'test_prepare_map_dashboard_data.py' -v
```

Review the generated `frontend/src/data/mapSnapshot.json` diff, source hash, category and governorate totals, excluded rows, and warning counts. The source-specific test assertions describe this reviewed workbook and should be updated only after a new source audit. Generation changes local frontend data only. It does not write Supabase, invoke b2match, or deploy. The historical 266-startup `supabase/seed/map_dashboard_snapshot.sql` belongs to the former published map path and must not be rerun as part of this refresh. Release still needs owner approval and a venue display check.
