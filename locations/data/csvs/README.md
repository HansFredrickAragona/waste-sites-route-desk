# CSV data inventory

CSV files are grouped by their role in the collection-location workflow. The original source files remain unchanged; generated and review files are stored separately.

## `raw/`

- `Drivers - raw.csv` — source driver schedule (504 rows).
- `SWMD MAP - Baguio_SWMD_Google_MyMaps.csv` — source collection-site map export (670 rows).

## `cleaned/`

- `cleaned_drivers_dataset.csv` — prepared driver schedule (149 rows), produced from the raw driver file.

## `summaries/`

- `central_district.csv` and `non_central_district.csv` — district splits of the driver schedule.
- `barangay_sites.csv` — barangay-to-site summary derived from `data/jsons/maps/swmd_map.json`.
- `barangay_sites_swmd.csv` — barangay-to-site summary derived from the raw SWMD map export.

## `mapping/`

- `swmd_coordinate_lookup_v2.csv` — coordinate and locality lookup review for the 670 SWMD rows.
- `swmd_map_csv_json_comparison.csv` — row-level comparison between the SWMD CSV and JSON map.
- `schedule_area_research_v2.csv` and `schedule_area_research_v3.csv` — schedule-area research notes and source links.
- `mapping_audit_swmd_v2.csv` and `mapping_audit_swmd_v3.csv` — row-level map-to-schedule assignment audits.
- `schedule_area_research_v4.csv` — reviewed decisions for 247 distinct schedule area labels, including explicit unresolved locations.
- `mapping_audit_swmd_v4.csv` — one entry for each of the 670 SWMD rows, with its v4 assignment status and source area. In the current audit, 548 rows are matched, 60 were reviewed but not selected, 54 are unmatched, and 8 have invalid coordinates. An audited row is not necessarily a scheduled collection site.
- `schedule_area_research_v5.csv` — independent v5 area decisions copied from v4, with the Celestial Village site update recorded separately from v4.
- `mapping_audit_swmd_v5.csv` — the 670-row v5 assignment audit.
- `area_mapping_status.csv` and `area_mapping_status_swmd.csv` — driver schedule mapping summaries.

## `output/bida/`

Six site-summary CSVs exported on 2026-10-29 from the owner-supplied `updated_Oct 29.json` review export:

| File | Barangay in the review JSON | Site records |
| --- | --- | ---: |
| `irisan_summary.csv` | Irisan | 60 |
| `dominican_summary.csv` | Dominican Hill-Mirador | 7 |
| `bakakeng_central_summary.csv` | Bakakeng Central | 29 |
| `guisad_central_summary.csv` | Guisad Central | 4 |
| `gibraltar_summary.csv` | Gibraltar | 13 |
| `happy_hollow_summary.csv` | Happy Hollow | 8 |

Each CSV has exactly the requested columns: `Site name`, `Purok`, `Longitiude`, `Latitude`, `Googlemaps view`, `Pick-Up`, and `Drop-off`. The requested `Longitiude` spelling is retained. Each row represents one saved site pin, in its source order. The seven firing-line paths in these barangays are separate map features and are not site rows.

The 121 rows retain all site records, including four marked **Removed collection point** (two Irisan, one Dominican Hill-Mirador, one Bakakeng Central). Status is not included in the requested seven columns; these files are not an active-only or confirmed-only inventory. Ten missing purok values and other missing values remain blank. Pickup/drop-off cells use the current saved `schedule`, preserve day/time wording (including unresolved values), and join multiple entries with `; `. Historical `sourceSchedule` values do not replace current schedules. Saved Maps links and coordinates are preserved.

Files use UTF-8 with a BOM, comma delimiters, CRLF line endings, and quoted fields where required. All 121 rows were read back with a CSV parser and checked against the supplied JSON. The source JSON and app files were not changed.

The owner's follow-up adds **`firing_lines_summary.csv`** alongside the six site summaries. It contains all seven saved firing lines for the selected barangays: six Bakakeng Central paths and one Gibraltar path, totaling 143 points. The other four selected barangays have no firing lines in this review JSON. The first row is `Firing line name` followed by each original line name as a column header. The first point row starts with `Points`; following row labels are blank. Each coordinate cell contains `longitude,latitude`, with blank cells after a shorter path ends. The source stores points as latitude/longitude arrays, so only the pair order is reversed for the requested export. Source precision, path order, and repeated points are preserved. All coordinate cells and blank padding were checked against the JSON after CSV parsing. The original six site-summary CSVs are unchanged.

**`firing_lines_summary_with_maps.csv`** is the subsequent version requested by the owner. Each original firing-line coordinate column is immediately followed by a Google Maps URL column named `<firing line name> - Google Maps`. All 143 points have a link, with blank coordinate/link pairs after shorter paths end. Coordinate cells remain `longitude,latitude`; Maps URLs use `https://www.google.com/maps?q=latitude,longitude`. CSV parsing verified that every link matches its adjacent coordinates and that removing only the link columns reproduces the earlier firing-line CSV exactly. The original firing-line CSV, site summaries, and source JSON remain unchanged. This CSV contains plain URLs rather than spreadsheet hyperlink formulas.

## Data flow

```text
raw/Drivers - raw.csv
  → cleaner.py
  → cleaned/cleaned_drivers_dataset.csv
  → update_driver_json.py
  → data/jsons/schedules/driver_schedule_v3.json
  → mapping/mapping_audit_swmd_v3.csv and mapping/schedule_area_research_v3.csv

raw/SWMD MAP - Baguio_SWMD_Google_MyMaps.csv
  → barangay_sites_from_swmd.py
  → summaries/barangay_sites_swmd.csv
```

Scripts use these category folders directly. Run them from the `locations` directory; see [`../../scripts/README.md`](../../scripts/README.md) for commands.
