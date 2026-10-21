# Waste Sites Route Desk

Baguio City waste-collection project with a collection-site and driver-schedule map editor, a separate recreation of the waste-management website, and supporting data, analysis, and presentations.

## Projects

| Project | Purpose | Documentation |
| --- | --- | --- |
| [`locations/`](locations/) | Prepare collection-site and driver-route data, then review schedules and edit mapped sites in a React demo. | [Locations README](locations/README.md) · [Demo guide](locations/demo/README.md) |
| [`bwms-clone/`](bwms-clone/) | Recreate the waste-management dashboard and record-management screens using Nuxt and Vue. | [Website duplicate README](bwms-clone/README.md) |

The applications run independently. The website duplicate uses demonstration records and does not load the `locations` datasets or connect to a live Baguio City service. The map editor stores changes in the browser and exports new JSON files.

## Run locally

Use Node.js 22.12+ and npm for the web applications. Each app has its own package manifest and lockfile; run commands from its folder.

### Collection schedules and site map

```bash
git clone https://github.com/HansFredrickAragona/waste-sites-route-desk.git
cd waste-sites-route-desk/locations/demo
npm ci
npm run dev
```

Open the local URL printed by Vite, normally <http://127.0.0.1:5173>. The demo opens on the bundled v5 schedule and supports driver and barangay filters, collection pins, firing lines, bounded areas, review confirmations, JSON import, and JSON export. Map tiles need an internet connection.

Google Street View is optional. Copy `locations/demo/.env.example` to `locations/demo/.env.local`, replace the placeholder key, and restart the demo. See the [demo guide](locations/demo/README.md) for setup and editing behavior.

### Waste-management website duplicate

From the repository root:

```bash
cd bwms-clone
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. The app opens directly on the dashboard and provides local record-management interactions.

Run `npm run build` inside either app folder to produce its production build, then `npm run preview` to preview it.

## Data preparation

The Python scripts in `locations/scripts/` clean driver schedules, prepare barangay summaries, and generate versioned schedule JSON and mapping audits. They use Python with `pandas` and `numpy`.

Start with the [locations README](locations/README.md) for the data layout and workflow. Existing datasets are included, so Python is only needed when regenerating them. Some route assignments remain unresolved and are marked for review in the data and mapping audits.

## Repository layout

```text
waste-sites-route-desk/
├── locations/
│   ├── data/              Source CSVs, prepared data, audits, and schedule JSON
│   ├── demo/              React, Vite, and Leaflet map editor
│   ├── questionnaire/     GSO site and schedule review questions
│   └── scripts/           Python data preparation and JSON generation
├── bwms-clone/            Nuxt and Vue website duplicate
├── output/               Standalone HTML prototype and presentation draft
├── Baguio_Waste_Collection_Story_v3.pptx
├── Waste_Collection_Optimization_Case_Analysis.docx
├── trash_collection_optimization_calculations_v1
└── HANDOFF.md             Historical project handoff notes
```

## Environment files and credentials

The repository-wide `.gitignore` excludes real `.env` files, local credentials and private keys, dependency folders, build output, Python caches, and logs. The tracked `.env.example` contains a placeholder so developers can create their own local configuration.

Keep actual keys in an ignored local environment file. Vite variables prefixed with `VITE_` are delivered to the browser; restrict the Google Maps browser key to the intended website referrers and APIs, and never use these variables for server secrets. Dependency lockfiles, source datasets, and project documents are included for reproducibility.
