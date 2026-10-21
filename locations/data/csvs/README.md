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
