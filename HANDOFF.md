# Baguio project handoff

**Updated:** Monday, October 26, 2026 (Asia/Manila)

## Current focus: Personal field collection tool

The active app is `locations/demo/barangay sites demo/`, a React, Vite, and Leaflet tool for personally collecting Baguio collection-site data in the field, organized by barangay. Its bundled source dataset is `locations/data/jsons/barangays/barangay_sites_v2.json`; it is generated from the annotated SWMD sites CSV and adds per-site review metadata. The original `barangay_sites.json` export is preserved. The product direction and staged plan are in `ROADMAP.md`.

### Current prototype behavior

- Site records can be reviewed and edited for name, pickup and drop-off schedules, coordinates, status type, remarks, purok, and review notes. Saving a site updates its status date automatically.
- **Add GPS pin** requests the device's current position, opens a new pin at those coordinates, shows the reported GPS accuracy, and saves a Google Maps link. Separate floating map controls recenter on the user's current location or return to the selected pin; when no pin is selected, the pin control shows all mapped pins. The site form includes purok and pickup/drop-off date, day, and time fields. **Add pin** remains available for manual map placement.
- Purok can be selected from the saved list or typed directly. GPS capture requires browser location permission and HTTPS or localhost.
- Mobile layout now uses a sticky compact view switcher, responsive header actions, and isolated map stacking so floating map controls stay within the map panel.
- Barangay details can update the barangay name, purok list, and notes.
- Site review metadata includes a barangay-confirmation flag, an automatically updated change status and last-reviewed timestamp, and a `{ date, action }` history entry when site details change.
- JSON datasets can be added, selected, exported, and removed from the browser-based selector. Each dataset keeps a separate local review copy.
- Firing lines support drawing and editing nodes. Right-clicking a node opens actions to disconnect the next segment, delete the selected node, or remove the line. Backspace deletes the selected node; Ctrl+Z undoes supported recent edits. The Pins panel minimizes during firing-line drawing/editing and expands after saving or cancelling.
- The map uses OpenStreetMap tiles. Google Street View editing needs a Maps API key; map links and pasted coordinates remain available without one.
- Review state persists in browser storage and can be exported as JSON. The prototype does not write edits back to its input JSON.
- The prototype source is organized into app composition, layouts, feature modules, shared UI/utilities, and global styles. The demo README describes the folder structure.

### Start the prototype

Requires Node.js 20.19+ or 22.12+. In PowerShell:

```powershell
cd "C:\Users\Hans\Downloads\Personal\CODE\BAGUIO\locations\demo\barangay sites demo"
npm install --prefix ..
npm run dev
```

Vite prints the local URL (normally `http://127.0.0.1:5173`). Map tiles require an internet connection. The optional production build is `npm run build` from this demo folder. It was not run for the latest UI changes; the user plans to review the prototype manually.

### Data workflow and key files

To regenerate the demo input JSON, run from `locations/`:

```powershell
python scripts/json_generation/generate_barangay_sites_json.py
```

The generator reads the annotated SWMD CSV and writes `data/jsons/barangays/barangay_sites_v2.json` using the example schema at `data/jsons/examples/barangay_sites_format.json`. The generated JSON includes site schedule, status, remarks, coordinates, and per-site review fields; missing coordinates remain reviewable in the app. It leaves the original `barangay_sites.json` unchanged.

| Area | File or folder |
| --- | --- |
| Prototype composition | `locations/demo/barangay sites demo/src/app/App.jsx` |
| Barangay review state and actions | `locations/demo/barangay sites demo/src/features/barangay-review/hooks/useBarangayReviewController.js` |
| Map and site-review components | `locations/demo/barangay sites demo/src/features/barangay-review/components/` |
| Browser review persistence and JSON workspaces | `locations/demo/barangay sites demo/src/features/json-library/services/reviewRepository.js` |
| Shared layouts and UI | `locations/demo/barangay sites demo/src/layouts/` and `src/shared/` |
| Prototype styles | `locations/demo/barangay sites demo/src/styles/global.css` |
| Map coordinate parsing | `locations/demo/barangay sites demo/src/features/barangay-review/data/mapCoordinates.js` |
| Source demo data | `locations/data/jsons/barangays/barangay_sites_v2.json` |
| Source JSON schema example | `locations/data/jsons/examples/barangay_sites_format.json` |
| JSON generator | `locations/scripts/json_generation/generate_barangay_sites_json.py` |
| Data generation notes | `locations/scripts/README.md` and `locations/data/jsons/README.md` |

The codebase is a Git repository at the workspace root, currently on branch `main`, with remote `origin`. Check `git status --short` before staging future work.

## Other active project areas

| Work area | Start here | Notes |
| --- | --- | --- |
| Weekly schedule and site-map demo | `locations/demo/site schedule demo/` | React + Vite; uses the v3 schedule and SWMD site index. |
| Mapping data and audit history | `locations/HANDOFF.md` | Contains the schedule-mapping workflow, review counts, and unresolved data questions. |
| GSO site-review questionnaire | `locations/questionnaire/GSO_site_schedule_questionnaire_draft.md` | Draft for confirming ambiguous routes and collection-site assignments. |
| Waste-management app clone | `bwms-clone/` | Separate Nuxt/Vue demonstration app. |
| Presentation and prototype outputs | `output/` | Includes the waste-collection presentation and dumping-records prototype. |

Preserve unresolved mapping labels and schedule times until the data owner confirms them. Treat low-confidence coordinate and route mappings as review candidates rather than official assignments.
