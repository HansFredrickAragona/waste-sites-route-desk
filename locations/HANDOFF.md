# Baguio waste collection data handoff

## Project

This project prepares Baguio City driver schedules and collection-site data, maps schedule areas to SWMD locations, and produces a structured version 3 schedule JSON.

## Data folders

```text
locations/
├── data/
│   ├── csvs/
│   │   ├── raw/         # Original driver schedule and 670-row SWMD map export
│   │   ├── cleaned/     # Cleaned driver schedule
│   │   ├── summaries/   # District and barangay summaries
│   │   └── mapping/     # Coordinate lookup, comparison, research, audits, status reports
│   └── jsons/
│       ├── schedules/   # Legacy and versioned driver schedules
│       ├── maps/        # SWMD map JSON
│       └── examples/    # Driver format example
└── scripts/
    ├── data_preparation/
    └── json_generation/
```

The CSV inventory and lineage are documented in [`data/csvs/README.md`](data/csvs/README.md).

## Active workflow

Run from the `locations` directory:

```bash
python scripts/data_preparation/cleaner.py
python scripts/data_preparation/extract_barangays.py
python scripts/json_generation/update_driver_json.py
```

The updater reads `data/csvs/cleaned/cleaned_drivers_dataset.csv`, the 670-row source map in `data/csvs/raw/`, the coordinate lookup in `data/csvs/mapping/`, and the legacy mapped schedule JSON. It writes `data/jsons/schedules/driver_schedule_v3.json` and refreshes the v3 audit and schedule research CSVs in `data/csvs/mapping/`.

Each driver schedule day retains its time and has one area object per route fragment. Mapped areas carry SWMD site records and coordinates. Unresolved areas remain visible with null-coordinate markers for review. Purok reverse-geocoding values are labeled as candidates and retain the full map label and lookup status.

## Current dataset sizes

- Raw driver schedule: 504 rows.
- Cleaned driver schedule: 149 rows.
- Raw SWMD map: 670 rows.
- SWMD barangay summary: 129 barangays.
- Version 3 mapping audit: 670 source rows.
- Version 3 schedule-area research: 102 distinct area labels.

## Review items

- Some schedule fragments name roads, landmarks, subdivisions, or market corridors instead of barangays; these remain documented in the mapping reports and audits.
- The source contains one `3pm-12mn` time value. Confirm its intended meaning with the data owner before changing it.
- The v3 audit marks lower-confidence or unresolved assignments for human review.

## Tomorrow's continuation — 2026-10-16

Last confirmed refresh: 2026-10-15 at 11:20 (local time). `driver_schedule_v3.json`, `mapping_audit_swmd_v3.csv`, and `schedule_area_research_v3.csv` were regenerated together. The coordinate lookup was last updated at 11:11.

### Current review snapshot

- The v3 mapping audit has 670 SWMD rows: 632 matched, 32 with blank status, and 6 marked `firingline`.
- Confidence counts are 21 high, 501 medium, and 148 low. The 649 low- or medium-confidence rows are marked for human review; the 21 high-confidence rows are not.
- The v3 schedule-area research file has 102 distinct labels; 56 are marked for human review and 46 are not.
- The generated v3 schedule JSON is about 1.8 MB and was written at the same 11:20 refresh.

### Start here tomorrow

1. Review `data/csvs/mapping/mapping_audit_swmd_v3.csv`, prioritizing the 32 blank-status rows, 6 `firingline` rows, and low-confidence assignments. Use the `review_note`, `rationale`, and `research_source` columns when checking each assignment.
2. Review the 56 flagged rows in `data/csvs/mapping/schedule_area_research_v3.csv`. Confirm candidate locations and truck-accessible roads from the cited sources; do not treat candidate reverse-geocoding results as confirmed locations.
3. Confirm the source schedule's `3pm-12mn` value with the data owner before changing it.
4. After making approved mapping or schedule decisions, rerun the active v3 updater from the `locations` directory:

   ```bash
   python scripts/json_generation/update_driver_json.py
   ```

5. Check that the updater refreshed `data/jsons/schedules/driver_schedule_v3.json`, `data/csvs/mapping/mapping_audit_swmd_v3.csv`, and `data/csvs/mapping/schedule_area_research_v3.csv`, then recheck the review counts above.

Preserve route fragments and their time values. Keep unresolved areas visible with null-coordinate markers until they are reviewed.
