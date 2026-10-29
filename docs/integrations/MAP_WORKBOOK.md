# Map workbook import

## Current source and interpretation

The local `/map` snapshot is generated from `Map Data.xlsx`, SHA-256 `317355253f71e1ecc69b5c27402c04babc3f0e7e69007e9ef67212b1dd31dbde`. This is a different source and population from the earlier 265-startup `Map Master - E4DE v2.xlsx` import and the historical 266-startup `Participants List.xlsx` seed. The browser bundle contains aggregate counts and source provenance only. **The source workbook itself is already tracked in Git** (commit `3a6413e`) and includes legacy sheets with startup names and codes. Its repository exposure needs review before any new publication; stopping future tracking would not remove earlier Git history.

The importer reads rows 5–670 of the visible `DATA - Support Measures` sheet. Row 4 names column B `Women-led`, C `Governorate`, D `Economic Sector`, and E `Staff Delta`. The owner confirmed that each of these 666 rows represents one distinct startup and that `Staff Delta` is the current employee count for this dashboard. The sheet has no startup identifier, so the workbook alone cannot independently prove uniqueness or deduplicate rows with matching attributes. The importer counts every source row once, rejects gaps and invalid values, and does not invent IDs. A value of `1` in `Women-led` contributes to Female-led; `0` contributes to Male-led. A positive `Staff Delta` contributes one employing startup, while all nonnegative integer values contribute to total employees. Programme stage is not used in the current map snapshot.

The visible `Map master (LENA)` sheet is a formula-derived presentation view. The importer checks its row count and cached columns A–G against the authoritative support-measures rows, including the leadership split, employment, and sector. The hidden legacy `Map master`, `Sheet4`, `Summary`, `all E4DE`, and event-participant sheets do not feed the current snapshot. Recalculate and save the workbook after any source edit so its cached formula values are current before regeneration.

Governorates are matched through explicit spelling aliases and normalized to the 12 map IDs. Unknown governorates, unexpected nonblank sector labels, invalid `Women-led` values, negative or nonintegral employee counts, and source-versus-visible-sheet disagreement stop generation for review.

## Sector classification

Each startup contributes to exactly one sector group. `SECTOR_SOURCE_GROUPS` in `scripts/prepare_map_dashboard_data.py` lists the accepted source labels; normalization changes case, spacing, and apostrophe style only. The importer also accepts the reviewed comma-versus-semicolon punctuation variant of the water-supply label. It does not infer a category from a word such as “Agritech.”

| Presentation group | Source labels in the current mapping | Count |
|---|---|---:|
| Technology & Digital | Information and communication | 42 |
| Green & Clean Tech | Agriculture, forestry and fishing; Water supply, sewerage, waste management and remediation activities (both reviewed punctuation forms) | 87 |
| Industry & Manufacturing | Manufacturing; Construction | 205 |
| Health & Social Impact | Human health and social work activities | 48 |
| Education & Creative | Education; Arts, entertainment and recreation | 131 |
| Commerce & Services | Administrative and support service activities; Wholesale and retail trade; repair of motor vehicles and motorcycles; Professional, scientific and technical activities; Financial and insurance activities; Transportation and storage; Real estate activities | 95 |
| Hospitality & Tourism | Accommodation and food service activities | 36 |
| Other / unclassified | Missing or ambiguous source labels listed below | 22 |

The seven classified groups contain 644 records. The other 22 remain in the aggregate rather than disappearing from sector calculations: 16 blank labels, one `-`, one `Agriculture`, one `Agritech`, two `Electricity, gas, steam and air conditioning supply`, and one `Public administration and defense; compulsory social security`. These values need source correction or an owner-approved sector mapping before they can be reassigned. Do not claim the seven classified groups cover all 666 startups. Governorate percentages use the currently selected governorate's total as their denominator.

## Reconciliation and quality limits

| Measure | Current imported count |
|---|---:|
| Source rows counted as startups, by owner-confirmed row semantics | 666 |
| Represented governorates | 12 |
| Female-led / Male-led | 427 / 239 |
| Startups with positive `Staff Delta` | 192 |
| Sum of `Staff Delta` | 628 |
| Unclassified sector records | 22 |

| Governorate | Startups |
|---|---:|
| Aqaba | 148 |
| Karak | 101 |
| Mafraq | 125 |
| Jarash | 88 |
| Amman | 80 |
| Ajloun | 18 |
| Irbid | 62 |
| Ma'an | 15 |
| Balqa | 4 |
| Madaba | 1 |
| Tafilah | 19 |
| Zarqa | 5 |
| **Total** | **666** |

Governorate counts, the 427 + 239 leadership split, and all eight sector buckets each reconcile to 666. `Staff Delta` is a count of people, so its 628 total does not need to equal the number of startups. No source row has an unknown leadership or employee value under the importer's current validation. The 22 sector labels above are the remaining classification issue. The absence of unique IDs is a separate audit limit despite the owner's one-row-per-startup confirmation.

### Historical 265-versus-266 discrepancy

The earlier `Map Master - E4DE v2.xlsx` importer counted 265 unique stage-assigned E4DE codes after excluding 124 rows with stage `NA`; it showed Amman 22 and Go to Market 91. The historical `Participants List.xlsx` seed script counted rows 2–267 as 266 startups and explicitly expected an Amman Go to Market record named `Rewaq` with a blank E4DE code; its aggregate showed Amman 23 and Go to Market 92. That older workbook is not available here for independent row review. The new workbook's hidden legacy `Map master` contains row 269, code `SM913`, `alrewaq contracting company`, Amman, with stage `NA`. These may refer to the same entity, but the available records do not establish that identity. The one-record historical difference is localized to Amman / Go to Market, while the exact cross-workbook match remains unverified. The new 666-row support-measures population must not be described as a one-record correction of either historical source.

## Map geometry credits

The unchanged 12-governorate geometry derives from [Jordan Geo's bundled JOR ADM1 data](https://github.com/baselhusam/jordan-geo/blob/main/scripts/raw/jor-adm1.geojson) and [geoBoundaries JOR ADM1](https://www.geoboundaries.org/api/current/gbOpen/JOR/ADM1/), whose metadata gives a 2006 reference year. Jordan Geo's [data license note](https://github.com/baselhusam/jordan-geo/blob/main/LICENSE) calls the boundary data ODbL and requires attribution/share-alike. The [geoBoundaries site](https://www.geoboundaries.org/) calls its gbOpen data CC BY 4.0, while its Jordan API metadata names an underlying CC BY 2.5 source. These license statements conflict; do not assume the discrepancy is resolved. Keep source and license links in accessible product credits and confirm the governing terms before production. The venue map omits the former boundary-attribution footer line as requested; removing that line does not remove attribution obligations.

## Regeneration and review

Do not publish a modified source workbook with this map candidate. From the repository root, after recalculating and saving the workbook:

```sh
python3 scripts/prepare_map_dashboard_data.py 'Map Data.xlsx'
MAP_WORKBOOK_PATH='Map Data.xlsx' python3 -m unittest discover -s scripts -p 'test_prepare_map_dashboard_data.py' -v
```

Review the generated `frontend/src/data/mapSnapshot.json` diff, SHA-256, source and governorate totals, leadership/employment measures, and the unclassified-sector audit before building. Generation changes local frontend data only; it does not write Supabase, invoke b2match, or deploy. The historical 266-startup `supabase/seed/map_dashboard_snapshot.sql` belongs to an earlier published path and must not be rerun as part of this refresh. Production release needs separate owner approval and a venue-display check.
