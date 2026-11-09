# DEVELOPMENT CONTINUATION

## 1. Current Project Status

As of 2026-11-03 (Asia/Manila), this repository is on **main** at **df82058** (“Add draggable map column resizing”), aligned with **origin/main**. Firing-line purok assignment (section 22), the phone input auto-zoom fix (section 23), and selected-barangay CSV export (section 24) are local changes. None has been pushed or deployed.

The active product remains the Barangay Sites personal field-review app at **locations/demo/barangay sites demo/**. It is a responsive React/Vite/Leaflet app with browser-local review and session persistence, JSON import/export, GPS capture, site/firing-line editing, and a Cloudflare Pages short-Maps-link resolver. It has no login, database, or cross-device sync.

## 2. Most Recent Development Activity

- Commit **2aa4b6a** fixed the Barangay details editor by passing the missing **setBarangayDetailsDraft** setter to **ReviewDialogs.jsx**.
- The previous change set removed PWA installation/offline features and added the Cloudflare Pages Function for short Maps links.
- The owner confirmed that four older review JSON files deleted from **locations/data/jsons/barangays/output/** were intentionally deleted. The newer **oct-27-2026-bk_Cent-Irs-Dom_Mir.json** review export is tracked and must be preserved.

## 3. Last Known Working State

Checks run on 2026-10-28:

- Barangay schedule regression: 6 tests passed.
- Barangay Sites Vite build: passed, with a large-chunk advisory.
- Driver Schedule Vite build: passed, with a large-chunk advisory.
- BWMS Nuxt build: passed, with a Vue package-resolution deprecation warning.

These checks establish that the sources compile and schedule normalization tests pass. They do not verify phone interaction or the latest live Cloudflare deployment. The production URL previously used is [waste-sites-route-desk.pages.dev](https://waste-sites-route-desk.pages.dev/); the latest production SHA is unknown here.

## 4. Completed Features

- Barangay directory, dataset dashboard, editable map pins and firing lines.
- GPS pin capture and manual location placement.
- Site status, name, purok, pickup/drop-off day/time, remarks, notes, and confirmation fields.
- Barangay details and notes editing.
- Per-JSON browser workspaces, activity history, automatic field-session restore, JSON import/export.
- Local Vite and Cloudflare Pages short Google Maps share-link resolution in source.
- Separate driver schedule/map demo with v3–v6 data and v6 default.
- Separate BWMS mock screens using local records.

“Completed” here means implemented in source; it does not mean every path was manually validated in production.

## 5. Work Currently in Progress

The Barangay Sites changes requested on 2026-10-29 are implemented locally and await a real browser/phone UI check and owner review. The overview map and zoom-aware nearby-marker grouping from sections 26–27 are also local and unverified in a browser. The earlier handoff added **AGENTS.md**, **PROJECT_HANDOFF.md**, and this document; they remain uncommitted. The separate CSV exports are complete locally (see section 18).

## 6. Unfinished Tasks

### Confirmed unfinished behavior

- The driver-schedule dashboard’s area coverage and daily summary values are still hard-coded in **locations/demo/site schedule demo/src/data/dashboardSummary.js**. The owner previously requested dashboard values that update with the selected JSON. If schedule-dashboard work resumes, derive these numbers from the active schedule or clearly label fixed reference data.

### Known implementation gaps

- Barangay map filter selectors now filter assigned purok and site status in source; the real UI flow remains unverified because the in-app browser could not reach the local preview and Chrome computer access was denied.
- Embedded Street View needs a restricted **VITE_GOOGLE_MAPS_API_KEY**; manual coordinates and Maps links remain available.

### Documentation drift

- Root/locations/schedule READMEs describe v3–v5 and a v5 default. Current schedule-app source bundles v3–v6 and selects v6 for a new session. Correct those docs during a documentation task; use source as current behavior.

### Owner review not confirmed

- Earlier notes expected the owner to review the field workflow manually on a phone. Accessible history does not confirm whether this review was completed after the latest push.

## 7. Known Bugs

The owner reported mobile auto-zoom in the pin coordinate-entry field and throughout the firing-line editor on 2026-10-30. A local CSS fix sets pin and firing-line editor controls to 16px on phone-width layouts; verify on a physical phone before marking the behavior confirmed. Other limits are listed above; do not treat a successful build as proof of phone behavior.

## 8. Immediate Next Actions

For a new coding session:

1. Read AGENTS.md, PROJECT_HANDOFF.md, this file, and the relevant demo README.
2. Check Git status, branch, and latest commit.
3. If the owner asks to continue the app, first establish which demo and workflow they mean.
4. If the latest form fix or short Maps link matters, verify the exact production commit in Cloudflare and manually check the path on the owner’s phone/browser.
5. Prioritize the previously requested data-driven schedule-dashboard summary only if the owner wants schedule-demo work now.

Do not push or deploy without explicit owner authorization.

## 9. Short-Term Priorities

1. Owner review of phone field capture, session restore, site edits, and JSON export/import.
2. Replace or clearly label the static driver-schedule area totals if that dashboard is resumed.
3. Resolve schedule README version/default mismatch in a docs-only update.
4. Check the new assigned-purok and site-status map filters and firing-line schedule/confirmation save flow in a real browser, then verify the phone layout.

Items 1–4 are follow-up checks or separate workstreams. The owner requested the map filters and firing-line fields in this session; the local implementation is recorded in section 19.

## 10. Long-Term Roadmap

Follow ROADMAP.md: improve record organization and duplicate/incomplete data review, strengthen cleanup and portability, then consider stable IDs or sharing only when needed. The proposed Vue/Laravel database migration in **PHASE_2_SERVER_CLIENT_MIGRATION.md** is planned only and requires an owner decision about data model, database, authorization, and deployment.

## 11. Outstanding Decisions

- Has the owner completed manual phone review of the latest deployed build?
- Does Cloudflare production currently serve **2aa4b6a** with the Pages Function?
- What is the source of truth for schedule-demo area totals, and should all summary metrics be computed from the selected JSON?
- Should any further map filter be added beyond the owner's requested assigned-purok and site-status filters? The prior Review placeholder was removed.
- Is multi-device sync or multi-user access desired, or is per-device personal use sufficient?
- Should Phase 2 proceed? If yes, which database, authentication, server host, and import conflict policy?

## 12. Testing Instructions

From **locations/demo/barangay sites demo/**:

~~~powershell
npm run test:schedules
npm run build
~~~

From the driver schedule demo folder, run **npm run build**. From **bwms-clone/**, run **npm run build**. The demos share the install in **locations/demo**; the clone uses its own install.

The schedule tests cover day-row editing and JSON round trips for all 670 source sites. They do not cover GPS permissions, browser storage, visual layout, Cloudflare deployment, or the live API function.

## 13. Local Development Instructions

Requires Node.js 20.19+ or 22.12+ and npm.

~~~powershell
cd "locations/demo"
npm install
cd "barangay sites demo"
npm run dev
~~~

For the driver schedule demo, from locations/demo enter **site schedule demo** and run **npm run dev**. For the separate mock BWMS app:

~~~powershell
cd bwms-clone
npm ci
npm run dev
~~~

Open the URL printed by the dev server. Map tiles need internet. Phone GPS requires HTTPS or localhost; use the deployed HTTPS host for ordinary phone review.

## 14. Deployment Instructions

The Barangay Sites Cloudflare Pages settings documented in **locations/demo/barangay sites demo/DEPLOYMENT.md** are:

- Project root: **locations/demo**
- Build command: **npm run build:barangay-sites**
- Output directory: **barangay sites demo/dist**
- Deploy the Pages Function in **locations/demo/functions/** through Git integration or Wrangler.

Cloudflare deployment settings are not checked into this repository. A static upload alone omits the short-link resolver. Verify Pages reports the intended branch/commit and Function before saying the newest fix is live.

## 15. Important Warnings

- Export review data before clearing browser storage, switching domains/browsers/devices, or removing a JSON workspace.
- **locations/data/jsons/barangays/output/oct-27-2026-bk_Cent-Irs-Dom_Mir.json** is user review data and should remain intact. It is imported via Add JSON, not automatically loaded from the folder.
- Keep raw/canonical JSON and CSV sources. Some generator scripts overwrite generated canonical targets.
- Source schedule times and low-confidence mapping candidates may be unresolved; do not “correct” them without evidence.
- No PWA or offline behavior remains by design. **cleanupLegacyPwa.js** only removes registrations/caches left by earlier releases.
- A successful build is not proof of browser behavior or production deployment.
- Restrict any real Maps API key and never commit credentials.

## 16. Suggested First Task for the Next Agent

Read the three handoff files, then inspect the local Barangay Sites changes in section 19. If the owner resumes this work, verify the selected-pin details, both map filters, firing-line schedule/confirmation save and reimport, and phone layout in a browser without clearing existing review data. Verify the Cloudflare commit only if deployment review is requested.

## 17. Last Updated Date

2026-11-03 (Asia/Manila).

## 18. Completed Data Export — 2026-10-29

- Created `irisan_summary.csv` (60 sites), `dominican_summary.csv` (7), `bakakeng_central_summary.csv` (29), `guisad_central_summary.csv` (4), `gibraltar_summary.csv` (13), and `happy_hollow_summary.csv` (8) under **locations/data/csvs/output/bida/** from the owner-supplied **updated_Oct 29.json** in Downloads.
- Matched the requested Dominican to **Dominican Hill-Mirador**, and Happy Hallow to **Happy Hollow**, using the names in that JSON. Kept exactly the seven requested columns, including the requested **Longitiude** header spelling.
- Exported one row per saved site pin, with current schedules, original names/coordinates/Maps links, multiple schedule entries separated by semicolons, and missing values blank. No firing-line paths were converted to site rows. All 121 pins are included, including four marked removed; status/confirmation are outside the requested columns, so this is not an active-only or confirmed-only inventory.
- Verification: parsed all six saved CSVs, checked seven columns per row and every exported value against the JSON, confirmed 121 site rows and 25 blank cells, and verified the source SHA-256 stayed unchanged. Visually reviewed previews for all six extracts. These are data checks; no app build or browser flow was tested for this export.
- Updated the CSV inventory with counts, scope, formatting, and source details. App code, bundled/source datasets, review history, and pre-existing review exports were preserved. Files are local only; no commit, push, publish, or deployment was performed. No export blocker remains. Await owner review or a new task.
- Follow-up correction: added **locations/data/csvs/output/bida/firing_lines_summary.csv** with all seven saved firing lines (six Bakakeng Central, one Gibraltar) and 143 points. The four other selected barangays have no saved firing lines. It follows the owner's matrix layout: original firing-line names across columns, `Points` at the start of the first coordinate row, `longitude,latitude` in each point cell, and blank padding after shorter lines end. This supplements the earlier pin-only exports; no firing-line paths were converted into site rows.
- Verified every longitude/latitude pair, point count, path order, repeated point, header, and padding cell against the JSON using a CSV parser; reviewed the rendered preview. Confirmed the source JSON and all six site-summary CSVs were unchanged by hash comparison. This follow-up remains local only and changes no app code.
- Maps-link follow-up: created **locations/data/csvs/output/bida/firing_lines_summary_with_maps.csv** with a Google Maps URL column immediately beside each firing-line coordinate column (15 columns total, 49 rows including the header). Verified all 143 URLs against their adjacent coordinate strings and confirmed that dropping the new URL columns reproduces the previous firing-line CSV exactly. Reviewed previews covering all seven coordinate/link column pairs. The earlier firing-line CSV, six site CSVs, source JSON, and app code remain unchanged; this new version is local only.

## 19. Local Barangay Sites UI Work — 2026-10-29

- Selected-pin details now show only the requested data fields: name, assigned purok, coordinates, Pick-up and Drop-off schedule, Barangay confirmed status, remarks, and review note. Existing edit/map/delete actions remain. Source record count, raw purok text, source aliases/status heading, and status date were removed from the selected card; the source JSON data was retained.
- Map filters now narrow both map markers and the site list by assigned purok and site status type. The Review placeholder was removed. The filtered count is displayed, and filter selections persist in the browser field session.
- Firing-line add/edit now has one Pick-up and one Drop-off section with multiple day rows, optional typed times, and a separate Barangay confirmed toggle. Save and JSON reimport preserve the fields; old lines without them remain editable with blank schedule and unconfirmed status. Splitting a line retains the schedule and clears both segment confirmations.
- Verification: `npm run test:schedules` passed 7/7, including a new firing-line save/export/reimport case. `npm run build` passed with the existing over-500-kB Vite chunk warning. `git diff --check` found no whitespace errors. A real UI interaction test is still needed: the in-app browser could not reach the local preview, and the Chrome computer-use request was automatically denied.
- Next tasks: check filter results and selected pin/line forms at desktop and phone widths in a browser; confirm firing-line edits survive a real save and page reload; check JSON export/import without clearing existing user review data. Phone GPS and Cloudflare deployment were not tested. All current changes are local; no commit, push, or deployment was done.

## 20. Expandable Pins and Firing Lines Panels — 2026-10-29

- Superseded by section 21: the owner replaced the Expand/Restore buttons with a draggable column divider.
- Added an **Expand/Restore** control to each panel. Expanding Pins or Firing lines widens that side of the map page, keeps the map visible, and folds the other panel to its header. Starting an edit or drawing a line opens the relevant panel wide; the controls cannot close an active edit. The selected panel is part of the browser field session and is restored after a reload.
- Checked the regular and expanded layouts in a local browser at desktop and 390 px mobile widths. Switched between panels, restored the default layout, reloaded with Firing lines expanded, and opened then canceled a pin edit without saving review data. The mobile check used an emulated viewport, not a physical phone.
- Follow-up: perform a real phone review, including GPS, and complete the separate map-filter and firing-line save/export/import interaction checks noted in section 19. This panel feature has not been checked on Cloudflare or deployed by this task.

## 21. Draggable Map Column Divider — 2026-10-29

- Replaced both Expand/Restore buttons with a draggable divider between the map and the shared Pins/Firing lines column. Both sections remain in that column; the pre-existing Pins Minimize control remains. The divider also supports keyboard arrows and double-click to reset. A manually chosen width persists in the browser field session across barangays and reloads; the default edit view opens wider until a manual width is set.
- Verified in a local browser: dragged wider and narrower, checked the 300 px minimum panel width, reloaded to confirm width persistence, resized with an open pin edit, canceled the edit without saving, reset the width by double-click, and used an arrow key. At an emulated 390 px mobile width, the divider is hidden and the map and side column stack at equal width. No physical phone was tested.
- `npm run build` and `npm run test:schedules` passed; Vite still reports its existing JavaScript chunk over 500 kB. `git diff --check` found no whitespace errors. The change is local only: no push, Cloudflare check, or deployment was performed. Separate filter, firing-line save/import, and phone GPS checks remain from sections 19–20.

## 22. Firing-Line Purok Assignment — 2026-10-30

- Firing-line add/edit now accepts multiple assigned puroks. The editor suggests recorded barangay puroks and also accepts typed names. The assignment is optional; no puroks are inferred from the line geometry or nearby sites. Selected puroks appear in the line detail card and list.
- The line JSON stores `puroks` as an array. Import normalizes that array and accepts a legacy singular `purok` if present; older lines without either stay unassigned. The add/edit save and disconnect workflows preserve assignments; draft input text is removed from saved line data.
- Verified in a separate local browser origin: created a line with two puroks, saved and reloaded, then removed one and typed a custom purok during edit. Checked the editor at an emulated 390 px phone width. The existing schedule regression suite passes 9/9, including assignment, old-line import, and line-disconnect preservation checks; the build passes with the existing Vite chunk warning.
- Next: field-test on a physical phone and verify production only after an authorized push/deployment. The existing map purok filter still applies to site pins; firing-line filtering by assigned purok was not requested or changed here. No commit, push, or deployment was done for this change.

## 23. Phone Input Auto-Zoom — 2026-10-30

- Set all pin-editor and firing-line editor text inputs, selects, and textareas to 16px with a 44px minimum height on phone-width layouts. This includes the pin latitude/longitude fields, Maps-link/coordinate paste box, Site remarks, Review note, firing-line purok entry, schedule fields, and line-node location paste box. The 16px text size is intended to prevent mobile Safari from zooming the page when a field receives focus.
- Source review confirms the pin form already had a phone rule for its labeled fields; the Maps-link/coordinate textarea sat outside that selector. The firing-line form had no equivalent phone rule, leaving its fields at 9px. The new selectors cover both cases.
- Not verified in a browser or on a physical phone in this task. No tests or build were run. Change is local only; no commit, push, or deployment.
- Next: check the pin latitude/longitude, Maps-link/coordinate, Site remarks, and Review note fields plus every firing-line field on the owner's phone; confirm focus no longer changes page zoom and the 44px controls still fit the panel.

## 24. Selected Barangay CSV Export and Site Health — 2026-11-03

- Added **Export CSV** beside the selected barangay contact control. For a barangay without firing lines, one click downloads its saved site summary. When lines exist, a small menu offers separate **Sites CSV** and **Firing lines CSV** downloads. Map filters do not reduce the export. An unsaved pin/line edit disables export until saved or canceled.
- The site file follows the previous seven-column `output/bida/` format, including the requested `Longitiude` header. The line file follows the coordinate/Google Maps link matrix. The CSVs are summaries; JSON export remains the complete portable backup. Filenames include the barangay and local export date.
- Three focused CSV tests and the app build passed after the final menu change; Vite retains the over-500-kB chunk warning. Nine schedule regressions passed before that menu change; a final rerun hit a sandbox Node permission error, and the elevated retry was rejected. A local browser check verified the button, menu, and one site CSV download. The browser's automatic approval review denied a later firing-line download from the temporary localhost preview, so that download remains unverified in the browser. The CSV builder itself passed a focused test.
- Health check: the Cloudflare site returned HTTP 200 and loaded 129 barangays/670 source records, map tiles, and no browser console errors. The published Maps-link function returned its expected 405 response to GET. The local preview at port 4185 was unreachable despite an older page remaining visible in the user's tab; a fresh browser recheck still received connection refused. The user's tab was not reloaded or altered. The published site does not yet show the local CSV feature. No commit, push, or deployment was performed.

## 25. Real-Browser QA Pass and Two Confirmed Fixes — 2026-11-03

- Ran automated checks against the current working tree: `npm run test:schedules` 9/9, `node --test scripts/selected-barangay-csv.test.mjs` 3/3, and `npm run build` passed with the existing over-500-kB chunk advisory.
- Ran five temporary Playwright/Chrome suites (kept outside the repository) against the local Vite dev server with a fresh browser profile: core review flow 14/14, firing-line/import flow 11/11, 390×844 phone layout 8/8, dialogs/dashboard/import-delete 7/7, and draw-mode guard 4/4. They covered directory search/filter, pin and firing-line edit/save/reload, undo, CSV and JSON exports, the Oct 27 review export import, barangay details and confirmation contact dialog, activity log, dashboard KPIs, invalid-JSON rejection, Delete JSON fallback, and no console/page errors.
- Fixed a real phone cascade bug in **global.css**: the `@media (max-width: 720px)` 16px/44px rule was losing to more specific 12px editor selectors, so only text inputs reached 16px. Added higher-specificity selectors for labeled fields, schedule-day selects, and time-period selects in both the pin and line editors. Verified 18 pin-editor and 14 line-editor controls at 16px/44px.
- Fixed a real map bug in **MapView.jsx**: clicking an existing pin or firing line while drawing a new line called `selectPin`/`selectLine`, which silently switched back to browse mode and discarded the in-progress line. Marker and polyline clicks now only select when `mode === "browse"`. Verified that pin/line clicks during draw mode leave the line intact and keep placing nodes, and that normal pin selection still works.
- Not verified: physical-phone behavior, Safari/iOS specifics, and production. All changes are local only; nothing was committed, pushed, or deployed. The working tree was also being edited concurrently during this QA pass, so the final suite run reflects the snapshot with the CSV export menu already in place.

## 26. Barangays Overview Map — 2026-11-03

- Added a **Barangays** tab with a Leaflet overview map and renamed the existing directory tab **Sites**. Selecting a marker zooms to and highlights it, opens a floating card with record and mapped counts, puroks, firing lines, barangay notes, and confirmation state, and shows **Where I am** and **Find selected pin** map controls. **Open site pins** returns to that barangay's existing review map.
- Marker positions are arithmetic centers of the barangay's mapped site-record coordinates and are labeled approximate, not official offices or boundaries. Barangays with no mapped site coordinates stay visible in an unplaced list; no coordinate is fabricated. The card's open action is disabled if switching would discard an unfinished edit.
- Marker pins are unnumbered to avoid confusing repeated site-record counts with pin IDs; the tooltip and detail card retain those counts.
- Current bundled source has 670 site records across 129 barangays, 663 records with coordinates; 128 barangays can be placed, and SLU-SVP Housing Village remains unplaced because its only source site has no coordinates. No source data or review exports were changed.
- Automated tests, build, and browser interaction were not run for this feature. It is local and uncommitted; no push or deployment was performed.
- Next: review the overview map at desktop and phone widths, especially marker overlap, map zoom, device-location permission, and floating cards. The zoom-aware proximity grouping in section 27 is the implemented response to crowded markers.

## 27. Barangay Proximity Groups — 2026-11-03

- Added deterministic, zoom-aware geographic grouping to the **Barangays** overview. Centers within 56 screen pixels are grouped while each member remains within that radius of every other member, preventing long chain-shaped groups. Group membership depends on center proximity; markers use the existing teardrop pin and white center dot without count labels. Counts remain available in the tooltip and group card.
- Clicking a group fits the map to its member centers and opens a floating member list. Choosing a barangay opens the existing details card; **Find selected pin** fits the selected group again. Individual markers remain unnumbered and retain their status colors and tooltips.
- This is a local UI-only change. No source/review data was modified. Tests, build, browser behavior, physical-phone layout, and production were not checked; `git diff --check` was run. No commit, push, or deployment was performed.
- Next: inspect the grouping density and floating cards at desktop and phone widths, including several centers at the same coordinates. Adjust the 56-pixel threshold only after reviewing the rendered map.

## Barangays search and filter — 2026-11-03
Added name search and existing review categories (Confirmed, Needs confirmation, No site pins) to the overview; markers, groups, unplaced list and totals use matching barangays. Local only. Build blocked by Node EPERM accessing nvm; browser verification remains outstanding.

## 28. Barangay Map Info Cards — 2026-11-03

- Selected barangay and group cards now open as Leaflet popups anchored beside their map locations. Clicking the map background closes the popup and clears the selection, matching the expected map-app interaction. The existing Where I am and Find selected pin controls stay outside the map click handler.
- Search/status filters and the unplaced-barangay detail card remain available. Data is unchanged. No build or browser interaction was run for this adjustment; `git diff --check` passed. Local only; no commit, push, or deployment.
- Next: verify popup placement near map edges and on phone width, background dismissal, group selection, and the Open site pins action in a browser.

## Draft cluster filter — 2026-11-03
Added the 128 CSV barangay assignments across 26 draft proximity clusters as a separate UI lookup; source CSV and review records unchanged. Barangays overview cluster filter combines with name search and review filters; unmatched names remain Unassigned. Details show draft cluster. Build passed using bundled Node, with existing >500 kB warning. Browser interaction not checked. Barangay boundaries remain pending: CSV contains no geometry and repository has no boundary dataset; asked owner about GeoJSON or public-data lookup. Local only, no deployment.

## Cluster colors — 2026-11-03
Overview pins now use stable draft-cluster colors, with gray for Unassigned and a collapsible cluster legend. Geographic proximity groups only combine barangays with the same CSV cluster assignment, preserving meaningful colors. Confirmation remains available in details and its filter. No polygons added for this simplified request. Build passed with existing >500 kB advisory; browser appearance not verified. Local only, no deployment.

## Barangay site-coverage polygons — 2026-11-03
Added translucent convex-hull polygons around each filtered barangay’s mapped site points, colored by draft cluster. Polygon click opens barangay details; pins remain visible. Shapes are approximate recorded-site coverage, not official boundaries; may overlap. Fewer than three distinct non-collinear points yields no polygon; no coordinates invented. Cluster/search/review filters apply to polygons. Build passed with existing >500 kB warning; geometry checks cover interior/duplicate points, collinear points and sparse data. Browser appearance not checked. Local only; no deployment.

## One marker per barangay — 2026-11-03
Supersedes zoom-aware geographic pin grouping: owner requires one pin per mapped barangay at every zoom. Removed proximity grouping from marker rendering; retained calculated centers, cluster colors, tooltips, selection and coverage polygons. Pins may overlap at wide zoom or identical centers; no positions fabricated. Unmapped barangays remain in the unplaced list. Build verification recorded below; browser interaction pending. Local only, not deployed.
Verification: Vite build passed after removing pin grouping, with existing >500 kB chunk advisory.

## Coincident barangay markers — 2026-11-03
Cluster 2 has four CSV assignments. Bundled Rock Quarry Middle and Upper share exactly [16.40877088,120.5861243], causing marker occlusion. Exact coincident centers now fan marker symbols horizontally in deterministic 36px steps; geographic positions and source data remain unchanged. Tooltip explains shared recorded center and visual offset. Build checked below; browser visual check pending. Local only. Inspection also found a source Asin Road latitude 160.407109; left untouched as uncertain source data, requiring review.

## Bida Barangays label — 2026-11-03
Renamed the Unassigned display category to Bida Barangays in cluster filter, legend, marker/polygon tooltips and barangay details. Internal unassigned filter value and CSV assignments remain unchanged; no confirmation status changed. Local only.

## Upper Magsaysay cluster alias — 2026-11-03
Fixed display/filter lookup: CSV explicitly includes Upper Magsaysay as alias of Magsaysay, Upper in Cluster 16. Shared assignedCluster helper now resolves both names for filter, details, marker/polygon colors and tooltips. Source names/records unchanged. Other unknown names retain Bida Barangays fallback label from previous owner request. Local only; browser check pending.

## Barangays navigation hierarchy — 2026-11-03
Combined former Sites and Barangays top-level tabs into Barangays, with Sites and Map subtabs. Sites covers directory and selected-barangay review; Map opens cluster/polygon overview. Retained Dashboard, review controls and selected-barangay resume/all-barangays navigation. Desktop/mobile share navigation component. No persistence schema or review data changes. Local only; browser layout/interaction check pending.
Vite build passed with existing >500 kB advisory. Updated mobile visibility selector for the navigation wrapper; physical/browser verification pending.

## Selected barangay shortcut close — 2026-11-03
Added browser-tab-style close button beside selected barangay shortcut, shown on hover/keyboard focus and always on touch. Closing clears selected barangay and returns to directory if reviewing its sites; overview stays open otherwise. Unsaved pin/line edits block closing with a save/cancel notice. Saved data unchanged. Browser interaction pending; local only.

## Cluster selection card — 2026-11-04
Added cluster selection to the Barangays overview map, replacing the static "Draft cluster colors" legend. A new **Clusters** panel at the **bottom-left corner of the map** lists every draft cluster that appears in the active JSON in a **two-column grid** with its color dot, name, and barangay count, so the usual 17–18 clusters fit without scrolling instead of a tall single-column list. Its header has a browser-style **minimize button** (−) that collapses the panel to a small title-and-count chip and swaps to (+) to restore it; unlike the old `<details>` summary, the control is an explicit button so it reads as a window control. Selecting a chip:
- sets the existing cluster dropdown to the same value, so the panel chips and the dropdown are one shared state in both directions — choosing a cluster in either control highlights the chip and opens the card;
- narrows the map to that cluster (the existing filter behavior) and refits the view to the cluster's approximate centers;
- opens a translucent glassmorphism card on the **right side of the map**, opposite the list, listing every barangay in the cluster with its site-record total, plus headline totals for total site records, barangays, mapped sites, and confirmed barangays. The card has **minimize/maximize** (collapses to its heading and total site count, restores the full list) and **close** controls.

Both map overlays use a real glass treatment — a low-opacity white/green gradient over `backdrop-filter: blur(...) saturate(...)`, translucent inner rows, and soft white borders — so the map stays visible through them. Where `backdrop-filter` is unsupported, a near-opaque white background is used instead so text stays readable.

The card sits below the two round recenter buttons so it never covers them, and becomes a full-width sheet at the bottom on phone widths; on those widths the cluster panel moves back to the top-left so the two overlays never stack. Clicking a barangay row keeps the card open and opens that barangay's details from its pin. The card's × or re-clicking the active chip returns the dropdown to "All clusters (draft)". Clicking the map background only deselects the pin; the selected cluster, the filter, and the current zoom/pan stay as they are. Before this fix the background click also cleared the cluster filter, so the map refit to all barangays and zoomed out. Barangay pins and coverage polygons outside a selected cluster still support the dimmed state used when the filters hide them. Counts describe the active JSON only; draft proximity cluster assignments, calculated centers, and site totals are unchanged source data. New files: `features/barangays/components/ClusterPanel.jsx`, `features/barangays/components/ClusterSummaryCard.jsx`, `features/barangays/data/clusterSummary.js`; `BarangaysOverview.jsx`, `BarangayOverviewMarkers.jsx`, `BarangayCoverage.jsx`, `data/clusterColors.js`, and `styles/global.css` were updated. Local only, not committed or deployed.

Verification: `npm run build` passed with the existing >500 kB chunk advisory. The glass blur and transparency, right-side card position, panel/card overlap, mobile sheet layout, the minimize/maximize toggle, and the two-way dropdown/chip sync were not checked in a real browser or on a phone.

## Selected barangay chip label — 2026-11-04
The header shortcut no longer changes its wording by tab. It previously read `Resume <barangay>` on the Sites view and `All barangays` on the barangay map view, which made the same control look like two different actions. It is now just the selected barangay's name, with no prefix word, and clicking it always opens that barangay's site review; the **Sites** subtab remains the way back to the directory, so the removed "All barangays" label loses no function. When the barangay review is the active view (`page === "map"`), the chip gets a light green tint, a darker border, and a deeper text colour so the selection is visible at a glance, and it carries `aria-current="page"`. The close (×) control and its hover/touch behaviour are unchanged. Edited `layouts/AppChrome.jsx` and `styles/global.css`. Build passed with the existing >500 kB advisory; the tint and label layout were not checked in a real browser or on a phone. Local only.

## Map state survives navigation — 2026-11-04
The overview map used to reset whenever you left the Map tab — for example select a cluster, select a barangay, press **Open site pins**, then return to Map, and the cluster, filters, selection, and zoom were all gone. The selected cluster, search text, barangay type filter, selected pin, selected nearby group, and the map center/zoom are now held in `app/App.jsx` (`overviewState`) instead of inside `BarangaysOverview`, so unmounting the map view no longer discards them. The state is in memory only and is not saved to the browser, so a page reload still starts fresh. A `previousFiltersRef` guard compares the filters with their previous values, so a remount does not clear a selection the user already made; the pin is cleared only when the filters actually change. `FitBarangayCenters` and `FocusOverviewMap` skip their first run when a saved view is restored, so returning to the map keeps the exact zoom/pan instead of refitting and flying to the last focus target. A new `PersistMapView` component records `moveend` into `overviewState.view`. State changes only from deliberate map actions: filter controls, cluster chips, pins, the cluster card ×, and the Clear filters button. Edited `app/App.jsx` and `features/barangays/components/BarangaysOverview.jsx`. `npm run build` passed with the existing >500 kB advisory and `npm run test:schedules` passed 9/9. The navigation round-trip was not clicked through in a real browser. Local only.

## Barangay outreach tracker (2026-11-06)

A separate localhost tracker in contact_barangays/outreach-tracker records meeting status, email sent, and text replies in two private working CSVs. The initial import uses the updated contact roster and the existing outreach checklist. Five complete meetings, seven scheduled meetings, and four sent emails were seeded. Python persistence and JavaScript syntax checks passed. The browser flow remains to be checked on the laptop because the verification environment blocked loopback HTTP requests.

## Everyday drop-off (2026-11-09)

The Drop-off day picker now offers **Everyday** for pins and firing lines. It saves as one schedule row with optional times. The rendered form and JSON round trip passed a targeted check, all nine schedule tests passed, and the build passed with the existing 500 kB chunk advisory. Browser interaction is pending. Local only.
