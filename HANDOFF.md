# Baguio project handoff

**Prepared:** Thursday, October 15, 2026 (Asia/Manila)  
**Resume:** Friday, October 16, 2026

## Start here tomorrow

The most recently edited area is the collection schedule and site-map demo in `locations/demo`. From PowerShell:

```powershell
cd "C:\Users\Hans\Downloads\Personal\CODE\BAGUIO\locations\demo"
npm run dev
```

Use Node.js 20.19+ or 22.12+. Vite prints the local URL (normally `http://127.0.0.1:5173`). The map needs an internet connection for OpenStreetMap tiles.

Latest file timestamps on October 15: `locations/demo/src/styles.css` and `locations/demo/src/components/ScheduleCell.jsx` around 3:03 PM; `locations/demo/src/App.jsx` around 2:39 PM. The recent interface work is in the weekly schedule cells, location warnings, and overall styling. The demo loads a weekly driver schedule, filters by barangay, and opens mapped sites on a map when a schedule cell is selected.

## Suggested first steps

1. Start the demo and pick up with the latest schedule-cell and style changes.
2. Check the schedule-to-map flow and the warning states for missing, unmatched, or removed site locations.
3. Continue with UI work, or switch to the GSO mapping review if the next milestone is confirming real site assignments. Use the questionnaire and mapping audit below; unresolved assignments should remain marked for review until GSO confirms them.
4. After making demo changes, run `npm run build` from `locations/demo` if you want a production-build check.

No app launch or build was performed while preparing this handoff.

## Project locations

| Work area | Start here | Notes |
| --- | --- | --- |
| Schedule and site-map demo | `locations/demo/` | React + Vite. Run commands from this folder. |
| Demo app entry and shared state | `locations/demo/src/App.jsx` | Loads the schedule and site index; switches between weekly schedule and map. |
| Schedule cell behavior | `locations/demo/src/components/ScheduleCell.jsx` | Area labels, map-status warnings, and warning tooltip. |
| Map view | `locations/demo/src/components/SiteMap.jsx` | Leaflet map and selected site details. |
| Schedule/data model | `locations/demo/src/data/scheduleModel.js` | Normalizes v3 schedule/site records and computes visible assignments. |
| Demo styling | `locations/demo/src/styles.css` | Most recently edited file. |
| Canonical v3 schedule | `locations/data/jsons/schedules/driver_schedule_v3.json` | Source schedule produced by the data workflow. |
| Demo’s v3 schedule copy | `locations/demo/public/data/schedules/driver_schedule_v3.json` | The app loads this copy. Its SHA-256 matched the canonical file on October 15. |
| Demo index and comparison refresh | `locations/demo/scripts/build-site-index.mjs` | `npm run data:refresh` reads the canonical schedule and raw SWMD CSV, then writes the site index and comparison/coverage reports. It does **not** copy the schedule JSON into the demo folder. |
| Detailed data handoff | `locations/HANDOFF.md` | Data workflow, current counts, data-quality flags, and review items. |
| Mapping audit and research | `locations/data/csvs/mapping/` | Start with `mapping_audit_swmd_v3.csv` and `schedule_area_research_v3.csv`. |
| GSO review questionnaire | `locations/questionnaire/GSO_site_schedule_questionnaire_draft.md` | Draft questions for confirming ambiguous routes and site assignments. |
| Waste-management app clone | `bwms-clone/` | Separate Nuxt/Vue demonstration app; start it with `npm run dev` from that folder. |
| Other presentation/prototype outputs | `output/` | Includes `Baguio_Waste_Collection_Story_v4.pptx` and `dumping-records-prototype.html`. |

## When schedule or map data changes

Keep the canonical schedule and the demo copy in sync. After updating `locations/data/jsons/schedules/driver_schedule_v3.json`, copy it to `locations/demo/public/data/schedules/driver_schedule_v3.json`, then run this from `locations/demo`:

```powershell
npm run data:refresh
```

That refreshes the SWMD site index and the comparison/coverage reports used by the demo. The source CSV inventory and data flow are documented in `locations/data/csvs/README.md`.

## Important open data questions

- The v3 mapping still has partial and unresolved site assignments. Treat the audit as a review aid, not confirmation from GSO.
- Preserve the original schedule time values until GSO clarifies `3pm-12nn` versus `3pm-12mn`.
- Confirm ambiguous area coverage and range-style routes with GSO before changing site assignments.
- `locations/HANDOFF.md` contains the full list of known data issues and the suggested review-sheet structure.

## Workspace note

Git status checks at the workspace root, `locations`, and `bwms-clone` returned “not a git repository.” No Git diff or history is available here to identify session changes; use the file timestamps and this handoff as the resume point.
