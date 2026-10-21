# Collection Locations and Driver Schedules

Prepare and review Baguio City collection-site and driver-route data, then explore and edit the schedules in the React map demo. This folder includes source CSVs, mapping research, versioned schedule JSON, Python preparation scripts, and the demo application.

[Whole project](../README.md) · [Demo guide](demo/README.md) · [Script guide](scripts/README.md)

## Run the schedule and map demo

Use Node.js 22.12+ and npm. From the repository root:

```bash
cd locations/demo
npm ci
npm run dev
```

Open the URL printed by Vite, normally <http://127.0.0.1:5173>.

The demo uses React, Vite, and Leaflet. It includes:

- Bundled v3, v4, and v5 schedules, with v5 selected by default for a new browser session.
- Weekly schedules with driver and barangay filters, assigned collection pins, and mapping notes.
- Pin editing, firing lines, bounded areas, and driver/day review confirmations.
- JSON import and numbered JSON export, including map features and review states.
- Browser-local working copies that remain after reload.

Map tiles require internet access. Embedded Google Street View is optional: copy `demo/.env.example` to `demo/.env.local`, set `VITE_GOOGLE_MAPS_API_KEY`, and restart Vite. The environment file is ignored by Git; the example contains only a placeholder. The key is used in the browser and should be restricted to the intended referrers and APIs. See the [demo guide](demo/README.md) for full setup and editing instructions.

The demo reads its own copies in `demo/public/data/`. Browser edits do not modify the source CSVs or canonical schedule JSON. Use **Export new JSON** to save a portable copy of your work.

To build or preview the demo, run `npm run build` or `npm run preview` from `locations/demo`.

## Folder layout

```text
locations/
├── data/
│   ├── csvs/
│   │   ├── raw/           Original driver schedule and SWMD map export
│   │   ├── cleaned/       Prepared driver schedule
│   │   ├── summaries/     District and barangay summaries
│   │   └── mapping/       Coordinate lookups, research, decisions, and audits
│   └── jsons/
│       ├── schedules/    Legacy and versioned schedule files
│       ├── maps/         SWMD map JSON
│       └── examples/    Example driver record format
├── demo/                 Interactive schedule and map application
├── questionnaire/        Draft GSO review questionnaire
├── scripts/
│   ├── data_preparation/ CSV cleaning and summaries
│   └── json_generation/  Schedule generators and mapping reports
└── HANDOFF.md            Historical data handoff and review notes
```

See the [CSV inventory](data/csvs/README.md) and [JSON layout](data/jsons/README.md) for more detail.

## Prepare or regenerate the data

Python is only needed to regenerate datasets; the demo can run with the included files. Use Python 3.12 with `pandas` and `numpy` for the preparation workflow. From the repository root:

```bash
cd locations
python -m pip install pandas numpy
python scripts/data_preparation/cleaner.py
python scripts/data_preparation/generate_tables.py
python scripts/data_preparation/extract_barangays.py
python scripts/json_generation/barangay_sites_from_swmd.py
python scripts/json_generation/update_driver_json.py
```

These commands rewrite prepared datasets and reports. The v3 updater reads the cleaned schedule, raw SWMD map, coordinate lookup, and legacy schedule, then writes the v3 schedule plus its mapping audit and area research CSVs.

To rebuild v5 from the existing reviewed v5 checklist, run this from `locations`:

```bash
python scripts/json_generation/build_driver_schedule_v5.py
```

It writes both the canonical and demo copies of v5 plus its audit. The optional `--seed` command is only for creating a missing v5 checklist; the reviewed checklist is already included. See the [script guide](scripts/README.md) for v4 generation and other utilities.

## Refresh demo data

After changing the raw SWMD map, run this from `locations/demo`:

```bash
npm run data:refresh
```

This rebuilds the site index, barangay lookup, and v3 comparison reports. It does not copy schedule JSON. The v4 and v5 generators write their own demo copies; after rebuilding v3, copy `data/jsons/schedules/driver_schedule_v3.json` to `demo/public/data/schedules/driver_schedule_v3.json` from the `locations` folder.

## Mapping review

The data includes partial and unresolved assignments. Use the mapping audits and [GSO questionnaire](questionnaire/GSO_site_schedule_questionnaire_draft.md) to review uncertain site assignments and route extents. Preserve unresolved fragments and original schedule times until the responsible data owner confirms them.
