# PROJECT HANDOFF

**Evidence labels:** VERIFIED means supported by current repository files, Git history, accessible Codex history, or checks run for this handoff. INFERRED means a reasonable reading, not a direct owner statement. UNKNOWN means the available evidence cannot settle it.

## 1. Executive Summary

BAGUIO, whose Git repository is named **waste-sites-route-desk**, contains data-preparation work and small web prototypes for Baguio City waste-collection sites, schedules, and operational records. The current product focus is the Barangay Sites field-review app in **locations/demo/barangay sites demo/**. It lets the owner inspect and update collection sites on a map while gathering information in the field. It is a React/Vite/Leaflet prototype with browser-local persistence and JSON import/export; it has no account system, shared database, or automatic sync.

The repository also contains a driver-schedule/map prototype, data-generation scripts and mapping audits, a separate Nuxt/Vue recreation of BWMS screens, interview/research artifacts, and presentations. These are separate parts of the repository, not one integrated application.

The most recent commit remains **2aa4b6a**, “Fix barangay details editing.” On 2026-10-29, the selected-pin details, assigned-purok/site-status map filters, and firing-line schedules/confirmation were changed locally without a push or deployment. The current Barangay schedule regression suite passes 7/7 cases and its Vite build passes with the existing large-chunk advisory. A browser interaction check of these latest changes remains outstanding.

## 2. Project Identity

- Repository: **waste-sites-route-desk**
- Git remote: https://github.com/HansFredrickAragona/waste-sites-route-desk.git
- Checked-out branch at handoff: **main**, aligned with **origin/main**
- Latest code commit: **2aa4b6ad0d65780d303a1973138cfcf0111f8e2d**
- Deployment URL previously used for the Barangay Sites app: [waste-sites-route-desk.pages.dev](https://waste-sites-route-desk.pages.dev/)
- **VERIFIED:** README.md describes a Baguio City waste-collection project with a site/schedule map editor, a separate BWMS recreation, data, analysis, and presentations.
- **UNKNOWN:** The project’s conceptual start predates the Git history in this checkout. The first repository commit is an import on 2026-10-21, not proof that the work began that day.

## 3. Project Background

The data work starts from driver schedule spreadsheets and SWMD map exports. The repository contains the raw driver schedule, a 670-row SWMD map export, cleaned and annotated CSVs, coordinate lookups, area-mapping research, audits, and versioned schedule/site JSON. Preparation scripts make intermediate summaries and demo-ready datasets.

The two map prototypes make uncertain or incomplete assignments visible for review. Their maps and status fields are review aids; they are not evidence that an assignment has been approved by the City or GSO.

Supporting artifacts include:

- A draft GSO questionnaire for clarifying schedule-to-site assignments.
- A waste-collection optimization case analysis, a calculations file, and presentation versions.
- A standalone City Waste Reports dumping-records HTML prototype.

The case-analysis document contains planning assumptions and a recommendation to test a limited two-shift pilot before scaling. It is a research/report artifact, not an implemented software feature or confirmed City decision.

## 4. Original Vision

**VERIFIED from accessible project conversations:** The first schedule prototype was intended to help officers visualize an existing driver schedule, choose a driver/day, inspect the corresponding sites on a map, filter by driver and barangay, verify positions with street-level imagery, and edit map data directly. The owner explicitly distinguished this from building a questionnaire. Pin editing, adding/removing sites, and representing routes or “firing lines” were part of that vision.

The separate Barangay Sites demo was requested as a new folder alongside the schedule demo. The owner expected to operate it while interviewing barangay officials, including sharing the screen and updating site information together. The requested first view was a barangay list with site counts; selecting a barangay opened its map and editable pins/firing lines. The later field workflow shifted toward the owner using the same responsive tool on a phone while visiting sites.

The broader data-gathering objectives recorded in accessible conversations are:

1. Verify the collection sites monitored by each barangay.
2. Determine collection schedules, including usual time windows.
3. Record collection practices relevant to the project.

The third objective is currently captured as free text in barangay notes, site remarks, or review notes. The app does not produce a structured comparison of practices.

## 5. Current Product Vision

**VERIFIED:** The current focus is a personal field data-collection and review tool. The owner can capture a location from device GPS or place it manually, add the site’s name, purok, pickup/drop-off schedule, status, remarks, and review notes, then export a portable review JSON.

The intended working model is one responsive web app on desktop and phone, hosted over HTTPS. Work is kept in each browser’s local storage; JSON export/import is the method for moving it between browsers or devices. A shared service or multi-user editing system is not implemented.

The repository roadmap proposes later improvements to site search, duplicate/incomplete-record review, data cleanup, stable identifiers, and optional sharing or operational connections. These are roadmap ideas, not all owner-approved commitments. The documented Vue/Laravel Phase 2 is also only a plan. Do not start that migration without a current request.

## 6. Target Users

- **Primary user — VERIFIED:** the project owner, who personally reviews and collects site data.
- **Interview participants — VERIFIED:** barangay officials may review information with the owner during interviews or screen sharing.
- **Schedule prototype users — VERIFIED:** officers reviewing driver/day assignments and collection locations.
- **UNKNOWN:** No confirmed multi-user roles, City-wide rollout, access-control policy, or authentication requirements exist.

## 7. Project Objectives

Confirmed objectives for the active Barangay Sites workflow:

- Keep the barangay and site list navigable while doing field work.
- Review site positions and record corrections without silently changing the source dataset.
- Record pickup and drop-off days and usual time windows.
- Record barangay-level practices separately from site-specific remarks and interview/review notes.
- Preserve completed edits and unfinished field-session context across browser reloads in the same browser.
- Make review data portable using JSON export and import.

Confirmed objectives for the separate driver-schedule prototype:

- Inspect driver assignments by weekday and see their mapped sites on a map.
- Make unresolved, incomplete, or uncertain schedule/site mappings visible for follow-up.
- Save map and review changes as a separate exported JSON rather than overwriting bundled source schedules.

## 8. Functional Requirements

### Current Barangay Sites app

- Show a barangay directory and site counts; open a barangay-specific map/review view.
- View and create, edit, or delete site pins and firing lines.
- Capture GPS with browser permission; retain reported accuracy and capture metadata; support manual placement and coordinate/link entry.
- Edit site name, purok, coordinates, source status type, pickup/drop-off schedule, remarks, review note, and confirmation.
- Filter the barangay map markers and site list by assigned purok and site status type. Site status is separate from barangay confirmation.
- Edit a firing line's Pick-up and Drop-off day rows, optional times, review note, and Barangay confirmed flag; splitting a line clears confirmation on both new segments.
- Edit barangay name, purok list, notes, confirmation details, and review state.
- Keep an activity log, import/select/export JSON workspaces, save review copies in browser storage, and restore an active field session.
- Provide a dashboard for the selected review dataset.

### Driver Schedule demo

- Show weekly schedules, driver/barangay filters, a selected-cell map, editable pins, firing lines, bounded areas, review confirmations, activity history, and versioned JSON export.
- Bundle schedule data v3 through v6; current source selects v6 for a new session.

### BWMS clone

- Recreate dashboard and record-management screens using local demonstration records. It is not connected to a live BWMS service.

## 9. Nonfunctional Requirements

- **Responsive/mobile use — VERIFIED:** the active field tool is intended to work on a phone and desktop from the same app.
- **Secure location context — VERIFIED:** browser GPS requires user permission and HTTPS or localhost. A phone using an ordinary HTTP laptop LAN address will not satisfy the secure-context requirement.
- **Internet — VERIFIED:** map tiles use OpenStreetMap and require a connection. Short-link resolution also requires an online endpoint. Embedded Google Street View requires the optional Maps JavaScript API key.
- **Data portability — VERIFIED:** use Export JSON and Add JSON to transfer review data. Browser storage is scoped to the browser, device, and hostname.
- **Offline operation — REJECTED as a product requirement:** PWA/service-worker support was removed at the owner’s request. The app does not promise offline startup or offline maps.
- **Data quality — VERIFIED:** preserve uncertain labels and missing values for review. Never turn a candidate or unknown assignment into a confirmed fact without evidence.
- **Maintainability — VERIFIED:** the owner rejected one-file “AI slop” implementations and asked for focused components and data utilities.

## 10. Business Rules

- Preserve source schedule and location data when normalizing or editing; do not mutate the imported source in place.
- Each site editor presents one Pick-up section and one Drop-off section. Each section allows multiple day rows; times are optional and entered as typed start/end times with AM/PM controls.
- Preserve all filled schedule entries when adding/removing days or saving. Empty legacy placeholders may be discarded; filled values must not be lost.
- Do not invent missing pickup/drop-off data, coordinates, barangay assignments, or route boundaries.
- Keep original area/barangay labels available. Normalize only for grouping/search where the UI needs it; do not replace source values with guessed names.
- A source site status and reviewer confirmation/change status are different concepts. In particular, a source status of “Removed” is not the same thing as a reviewer deleting a record.
- Mark a barangay/site confirmed only after the human reviewer confirms it. Low-confidence or unmapped data remains a review candidate.
- Site remarks describe a collection site; Update Barangay Details notes describe barangay-level practices; Review Notes record interview/review context.
- Delete JSON removes that workspace and its browser-saved copy from the current browser. It does not delete a source file from disk. The bundled JSON may be hidden from the selector.
- JSON files in **locations/data/jsons/barangays/output/** are project data artifacts and can be imported through Add JSON. They are not auto-loaded merely because they are in that folder; do not classify the folder as disposable build output.

## 11. UI/UX Requirements

Confirmed preferences and corrections:

- Reuse the schedule demo’s visual structure for the barangay demo, but keep features separated into readable modules.
- Use full weekday names. The owner corrected abbreviated day labels and requested the selected day text be centered horizontally and vertically.
- Schedule times are text inputs; AM/PM and day are dropdown controls. Provide Add day in each of the two schedule sections. Do not add an “Add another schedule” control or multiple pickup/drop-off section groups.
- Avoid nested/parent cards where the owner called out card overuse. Keep the site editor’s sections easy to scan, and remove helper headings/prompts when specifically requested.
- Preserve the “Barangay confirmed” toggle when removing its redundant “Site confirmation” heading. Current source includes the toggle without that separate heading.
- The checked-in Barangay README says Site remarks and Review note appear side by side on wide screens and stack on phones. This matches the current intended compact desktop/mobile layout; use current screenshots and source if the owner gives a later correction.
- Keep floating map controls within the map panel; previous stacking/scroll behavior caused problems.
- Show useful issue context and distinguish source counts from derived/selected-schedule counts. Do not present stale totals as dynamic.

The owner has repeatedly corrected implementations that did not match the screenshot or described layout. Treat exact labels, alignment, grouping, and retained controls as requirements rather than visual suggestions.

## 12. Owner Preferences

These are owner preferences supported by accessible conversations or current project instructions:

- Build a practical data-collection tool, not a questionnaire-only substitute.
- Extend existing apps and preserve working features; keep the two demos separate.
- Use small, focused components and data utilities rather than one giant source file.
- Preserve existing source files and create new versioned JSON outputs when transforming schedule data.
- Compare route/site labels carefully; keep exact names and document uncertain matches.
- Make the dashboard reflect the selected dataset and explain count scope. The current schedule dashboard still violates this in one area; see Known Bugs and Limitations.
- Keep the phone workflow simple. A responsive browser app is enough; the owner explicitly said they no longer plan to make this app a PWA.
- Give concise progress updates, inspect relevant code before changing it, and do not say a fix works based only on a file existing.
- The owner has used a confirm-before-push workflow. Do not push or deploy just because a change is buildable; get explicit authorization unless the current request already provides it.
- Ask about unresolved facts rather than fabricate. Where an answer is uncertain, explain what evidence is missing.

The swimlane reference remembered in an accessible Baguio assessment conversation is specific to swimlane/report illustrations: navy background, four horizontal lanes, vertical colored lane labels, matching process boxes, diamond decisions with YES/NO markers, and clear white arrows. Do not apply that report palette to the web apps without a separate request.

## 13. Explicit Restrictions

- Do not reintroduce PWA installation, service-worker caching, offline behavior, or PWA icons/manifest unless the owner explicitly changes direction.
- Do not overwrite original/canonical source CSVs or existing schedule/site JSON as a shortcut. Inspect generator destinations first; prefer versioned outputs.
- Do not delete files under **locations/data/jsons/barangays/output/** as cleanup without reviewing the file and owner intent. The owner previously confirmed four old review exports were intentionally removed and retained the newer Oct 27 review JSON; do not restore those deleted exports automatically.
- Do not treat the Google Maps browser API key as a secret-safe server credential. A VITE-prefixed value is available to the client; restrict it to permitted APIs/referrers.
- Do not change unresolved schedule times or low-confidence mappings into official facts.
- Do not replace the current React prototype with Vue/Laravel or add shared storage/auth without a current owner request.
- Do not assume a successful local build proves Cloudflare deployed the same commit.

## 14. Rejected Features and Approaches

| Rejected or corrected approach | Owner’s stated reason/correction | Current rule |
| --- | --- | --- |
| Questionnaire instead of an interactive schedule/map tool | The owner wanted officers to visualize schedules and update pins/routes themselves. | Keep the map review tool central; the GSO questionnaire remains a supporting draft. |
| Put the whole application in one TypeScript/JavaScript file | Owner explicitly asked to avoid “AI slop” and keep components separated. | Follow the existing feature modules and small-file structure. |
| Overwrite v3 or other source JSON when producing updated mappings | Owner requested separately versioned outputs. | Keep inputs immutable; inspect scripts before regeneration. |
| Multiple schedule groups per site or “Add another schedule” | Owner clarified there should be exactly one Pickup and one Drop-off group; users add days within a group. | Maintain two sections with multi-day rows and optional typed times. |
| Remove the confirmation switch when removing its heading | Owner corrected the agent: keep the toggle, remove only the “Site confirmation” text. | Preserve the current toggle and behavior; check the source before adjusting layout. |
| Overuse of parent/outer cards and extra helper copy | Owner explicitly asked to remove parent cards and named prompts/headings that crowded the form. | Prefer a compact editor; remove only the specifically requested copy. |
| PWA as a prerequisite for phone use or session retention | The owner asked why PWA was needed when the app already worked on a phone, then explicitly said they no longer planned to make it a PWA. | Use the deployed HTTPS browser app. Save the field workspace locally; do not re-add PWA features. |
| Cookies, heartbeat requests, or a laptop server to preserve the field session | The problem was page/tab reload and lost unfinished screen state, not an app login timeout. | Persist the workspace in local storage. Cloud sync is a separate unapproved future option. |
| Treat the JSON output folder as unrelated disposable output | The owner clarified those JSONs factor into the app; Add JSON imports review exports. | Preserve remaining review data files and distinguish manual import from auto-bundling. |
| Hard-code dashboard counts while presenting the dashboard as schedule-driven | The owner called the data static and requested it update with the selected JSON. | Derive metrics from active data or label fixed reference values clearly. Current schedule summary still needs follow-up. |
| Vague-area dashboard card/filter in the schedule demo | The owner later asked to remove that feature. | It is removed in current source; do not reintroduce without request. |

Earlier turns included both “beside each other” and “not beside each other” wording for the remarks/note layout. The later checked-in README/source describes side-by-side on wide screens and stacking on phones. If the owner revisits this detail, use the newest direct instruction or screenshot.

## 15. Technology Stack

| Area | Current stack |
| --- | --- |
| Barangay Sites app | React 19, Vite 8, Leaflet 1.9, React Leaflet 5; JavaScript/JSX and CSS |
| Driver Schedule app | React 19, Vite 8, Leaflet/React Leaflet from the shared locations/demo install |
| BWMS clone | Nuxt 3 and Vue 3; TypeScript data/config modules and Vue SFCs |
| Data preparation | Python 3.12 scripts using pandas and numpy where required; several JSON generators use Python standard libraries |
| Data storage for active apps | JSON files plus browser localStorage; no database/ORM |
| Map services | OpenStreetMap tiles; optional Google Maps JavaScript API for embedded Street View; Google Maps links and coordinate parsing |
| Deployment | Barangay app documented for Cloudflare Pages with a Pages Function; no checked-in Pages configuration file |
| Tests | Node built-in test runner for barangay schedule normalization/edit preservation |

The shared map demos are installed from **locations/demo/package.json** and its lockfile. The BWMS clone has its own package and lockfile. The repository root has no package.json.

## 16. Repository Structure

| Path | Purpose |
| --- | --- |
| README.md | Repository overview, run instructions, links to primary demo docs |
| AGENTS.md | Persistent operating instructions for future agents; added by this handoff |
| PROJECT_HANDOFF.md | Comprehensive project facts, history, constraints, and evidence |
| NEXT_STEPS.md | Operational continuation state and suggested next work |
| HANDOFF.md | Older root handoff notes; current app details are superseded by this file |
| ROADMAP.md | Personal field-collection product direction and stages |
| locations/data/csvs/raw/ | Source schedule, driver metadata, and SWMD map exports |
| locations/data/csvs/cleaned/, summaries/, mapping/ | Prepared tables, summary outputs, mapping research, and audits |
| locations/data/jsons/schedules/ | Canonical legacy and versioned driver schedule JSON, including v6 |
| locations/data/jsons/barangays/ | Raw/generated barangay site JSON and review exports |
| locations/scripts/data_preparation/ | CSV cleaning and summary generation |
| locations/scripts/json_generation/ | Schedule/site JSON and mapping audit generators |
| locations/demo/site schedule demo/ | Separate driver schedule/map prototype; has its own public data copies |
| locations/demo/barangay sites demo/ | Active personal field-review app |
| locations/demo/functions/ | Cloudflare Pages function wrapper used with locations/demo as the Pages root |
| functions/ | Root-level Pages Function wrapper for alternative project-root deployment layouts |
| bwms-clone/ | Separate Nuxt/Vue BWMS screen recreation with local demo data |
| locations/questionnaire/ | Draft GSO schedule/site mapping questionnaire |
| output/ | Presentation output and standalone dumping-records prototype |
| Waste_Collection_Optimization_Case_Analysis.docx, presentations, calculation artifact | Supporting analysis and communications, separate from app runtime |

Important current Barangay app files:

- Composition: [App.jsx](<locations/demo/barangay sites demo/src/app/App.jsx>)
- Review controller/state: [useBarangayReviewController.js](<locations/demo/barangay sites demo/src/features/barangay-review/hooks/useBarangayReviewController.js>)
- Pin and firing-line actions: [createMapEditingActions.js](<locations/demo/barangay sites demo/src/features/barangay-review/actions/createMapEditingActions.js>)
- Barangay-level actions: [createBarangayDetailsActions.js](<locations/demo/barangay sites demo/src/features/barangay-review/actions/createBarangayDetailsActions.js>)
- JSON import/export and persistence: [reviewRepository.js](<locations/demo/barangay sites demo/src/features/json-library/services/reviewRepository.js>) and [createJsonLibraryActions.js](<locations/demo/barangay sites demo/src/features/json-library/actions/createJsonLibraryActions.js>)
- Map/editor UI: [features/barangay-review/components](<locations/demo/barangay sites demo/src/features/barangay-review/components/>)
- Main style sheet: [global.css](<locations/demo/barangay sites demo/src/styles/global.css>)

## 17. System Architecture

### Barangay Sites app

Vite starts the React entry at **src/main.jsx**, which invokes a one-time cleanup for old PWA service workers/caches left by earlier versions. **src/app/App.jsx** composes the page and connects the review controller to feature components. The barangay-review feature owns map state, pin and line drafts, editing actions, and GPS handling. The json-library feature loads the bundled JSON, accepts uploaded arrays/review exports, stores each active workspace separately in localStorage, and downloads exports. Leaflet renders map tiles, pins, and firing-line geometry.

The input dataset is bundled from **locations/data/jsons/barangays/barangay_sites_v2.json**. Editing does not write to that input path. Saved review copies and the active workspace are in browser storage; export is the portable artifact.

### Driver Schedule demo

This is another React/Vite/Leaflet app. Its public folder has separate copies of schedules v3–v6 and map/site-index data. The app selects v6 for a new session, supports imported JSON schedules, local working copies, map editing, and versioned export. The data:refresh script rebuilds its SWMD-derived site index and v3 comparison reports; it is not the schedule generator.

### BWMS clone

Nuxt pages and shared Vue components render local demonstration screens. Page configurations and sample records are under **bwms-clone/data/**; composables handle local filtering and record interactions. It has no BWMS service API, auth backend, persistent database, or connection to the locations datasets.

### Data pipeline

Python scripts under **locations/scripts/** transform source CSVs into cleaned data, summaries, JSON versions, and mapping audits. Inspect each script’s input/output paths before running it: some scripts rewrite canonical generated data files.

## 18. Database and Data Models

There is no database in the current apps.

### Source barangay site JSON

The generator writes a list of site records. Each record includes:

- site_name
- barangay.name and barangay.purok
- schedule, with pickup/drop-off day/time values
- location.latitude, location.longitude, and location.google_maps_url
- status.type and status.last_updated
- remarks
- review.is_brgy_confirmed, change_status, last_reviewed, and change_history

See [barangay_sites_format.json](<locations/data/jsons/examples/barangay_sites_format.json>) and [generate_barangay_sites_json.py](<locations/scripts/json_generation/generate_barangay_sites_json.py>).

### Runtime review workspace

**reviewRepository.js** converts site records into schemaVersion 1 review state containing barangays, pins, firing lines, review flags, JSON source metadata, and activity log. It preserves source fields while holding editable/review fields separately. This runtime object is not the same as the original source array.

Persistent localStorage items include per-JSON review data, the JSON library/selector, the selected JSON, bundled visibility, and per-JSON workspace-session state. Storage is origin-specific and device/browser-specific; there is no cross-device merge.

### Driver schedule data

Canonical schedules are under **locations/data/jsons/schedules/**; the schedule demo also bundles copies under its **public/data/schedules/**. v3/v4/v5/v6 have different shapes. v6 adds driver metadata and annotated site information. Do not assume all versions share one schema; consult each builder and schedule-app normalization code.

### Reviewed output data

The tracked review export **locations/data/jsons/barangays/output/oct-27-2026-bk_Cent-Irs-Dom_Mir.json** is a review workspace, not a compiled asset. It records a 670-row source count, 129 barangays, and 660 runtime pins. The app can import it via Add JSON. Keep it intact unless the owner asks otherwise.

## 19. APIs and Integrations

- Barangay app local endpoint: POST **/api/resolve-google-maps-link** accepts JSON containing a shortened Maps URL and returns parsed latitude/longitude.
- Local development uses Vite middleware in the Barangay demo’s **vite.config.js**.
- Cloudflare Pages uses **locations/demo/functions/api/resolve-google-maps-link.js**, which delegates to the shared resolver. Wrappers also exist at **locations/demo/functions/** and the repository root for alternate Pages roots.
- The resolver only starts with HTTPS links from maps.app.goo.gl or goo.gl, checks each redirect remains on Google-owned HTTPS hosts, limits body size and redirect depth, and times out requests. It is needed because a static client cannot expand a short URL. The stable deployed path must receive the Pages Function; a static-only upload does not provide it.
- OpenStreetMap provides map tiles. Tile availability/requests need internet; attribution is shown.
- Embedded Google Street View uses optional VITE_GOOGLE_MAPS_API_KEY. If configured, restrict the browser key to intended website referrers and Maps JavaScript API.
- No authentication, app API for site CRUD, cloud sync, analytics, or remote data service exists.
- Cloudflare Pages is the documented Barangay app host. The stable URL used in conversation is https://waste-sites-route-desk.pages.dev/. Latest production deployment SHA was not independently checked during this handoff.

## 20. Core Business Logic

- The site generator reads the annotated SWMD CSV and emits barangay_sites_v2.json; it keeps schedule phrases visible, stores missing coordinates as missing, and seeds review confirmation false.
- buildInitialReview groups records by barangay, converts valid coordinates to numbers, retains raw source information, and creates runtime pin IDs.
- normalizeSiteSchedule merges old schedule group shapes into one pickup and one drop-off list; scheduleWithoutDates serializes day/time rows. Regression tests assert source schedules survive editing and JSON round trips.
- Pin and line changes are drafts until saved. Map edits produce review/activity history.
- Device GPS is accessed from the browser, first using precise mode and falling back to a faster, less precise location option. Accuracy is shown for human review.
- The field workspace is serialized as it changes, so a reload can restore the page, selection, map view, editor drafts, and pasted Maps link text. Reset session clears that active workspace but keeps saved review data.
- Schedule dashboard metrics are partly computed from the active schedule and map edits, but area coverage and weekday summary counts are still imported as fixed constants from **src/data/dashboardSummary.js**.

## 21. Development History

Git history begins with the import commit on 2026-10-21. It preserves the following sequence:

| Date | Milestone | Evidence |
| --- | --- | --- |
| 2026-10-21 | Repository imported; the two location demos separated and v6 schedule data added. | 099fed9, 9f0110b |
| 2026-10-21 to 2026-10-22 | Driver schedule dashboard details and the Barangay review prototype/GPS/mobile UI were added. | ce71be0, ec25622, 5dbdf40, e471b61 |
| 2026-10-23 | Schedule dashboard/export dialogs and site editing/confirmation improved; Barangay app refactored from a large App.jsx into feature modules. | af962c0, 7a03916, e818977 |
| 2026-10-23 | Pin editor, map placement, schedule fields, and day display refined. | 7269830, a69e595, 5935ea0 |
| 2026-10-26 | Review tracking metadata and persistent field sessions added. A PWA and Phase 2 migration plan were also committed. | 55e0edd, 734a0cf, 2c1e7be |
| 2026-10-26 | Schedule editing and GPS fallback expanded; regression checks added to protect schedule entries. | 62a3f43, 6eb0507 |
| 2026-10-27 | Owner rejected PWA direction; PWA runtime/manifest/install assets were removed. Cloudflare Pages short Maps-link resolver support was added. | f1a383f and accessible “Fix barangay and firing line editing” history |
| 2026-10-27 | Barangay-details inputs fixed by passing the missing draft setter into the dialog. | 2aa4b6a |

Do not use this chronological summary as a substitute for checking current source. Git history starts after much of the analysis work and does not contain all earlier sessions.

## 22. Major Technical Decisions

| Decision | Context and reason supported by evidence | Status |
| --- | --- | --- |
| Keep separate schedule and barangay demos | The owner requested a dedicated Barangay Sites project without replacing the schedule demo. | Current and applicable |
| Keep canonical JSON read-only from the UI; export review copies | Owner repeatedly asked to preserve original files and create versioned outputs. The apps use browser working copies and export. | Current and applicable |
| Use browser storage for single-user persistence | The owner wanted to resume field work on the same phone; a server heartbeat/cookie was not the solution to tab reloads. | Current; separate devices do not sync |
| Remove PWA support | Owner explicitly said they do not plan to make the app a PWA. | Current prohibition |
| Add server-side short-link resolver for production | A phone Maps link worked through a local resolver but production static hosting returned HTTP 405. A Pages Function was added. | Current code; production deployment must include function |
| Keep Barangay app modular | Large prototype file was refactored into feature folders and owner explicitly rejected monolithic code. | Current and applicable |
| Plan, but do not implement, Vue/Laravel/data-server Phase 2 | A separate migration plan exists to add DB-backed multi-client behavior while leaving the React app intact. No database choice or auth decision is made. | Planned only |

## 23. Mistakes and Corrections

| Problem | Correction and resolution | Status/lesson |
| --- | --- | --- |
| Barangay and firing-line form controls accepted clicks but not typed edits because setter callbacks were not passed/destructured through component props. | Setters were wired in the app; the later barangay-details bug was a missing setBarangayDetailsDraft destructure in ReviewDialogs.jsx, fixed in 2aa4b6a. The latest build succeeded. | Resolved in code; no visual production verification was performed in this handoff. Check callback wiring through every component boundary. |
| Schedule editor created confusing multiple schedule groups and risked dropping existing days when editing. | Owner specified exactly one pickup/drop-off section and multiple day rows. Normalization/serialization was corrected and six regression tests now cover merging and round-trip preservation. | Resolved and covered by current tests. |
| Early site editor layout added nested cards, helper text, or wrong grouping. | Owner asked to remove parent cards/extra prompts, correct spacing, keep only useful controls, and retain the confirmation toggle while removing its heading. | Current source/README reflect the latest compact form; follow the newest screenshot/instruction if revisited. |
| Assistant initially implied a PWA or server heartbeat was needed to preserve phone sessions. | Owner clarified that the app worked on phone and explicitly rejected PWA. Session persistence was implemented in browser localStorage; PWA features were later removed. | Resolved; do not reintroduce PWA or confuse this with auth. |
| Old review JSON exports were first called unrelated/unneeded. | Owner clarified output JSON files are used by the app; Add JSON imports review exports. The user separately confirmed deletion of four old exports was intentional. | Keep the current Oct 27 review JSON; do not restore intentionally deleted exports or indiscriminately clear this folder. |
| Dashboard once used values that looked dynamic but were fixed. | Owner requested that the dashboard reflect the selected JSON. Most schedule counts are derived, but areaCoverageSummary and dailyAreaSummary remain hard-coded today. | Partially unresolved; fix only when schedule-demo work is requested. |
| A hash-based Pages URL was initially interpreted as preview-only. | The owner shared a Cloudflare dashboard screenshot confirming production branch main at f1a383f; later commit 2aa4b6a was pushed. | Do not infer production status from hostname shape alone; check the dashboard or deployment record. |

## 24. Lessons Learned

- A local build proves bundling, not that every field works in the browser or that Cloudflare deployed a Pages Function.
- Controlled text inputs can look editable while failing if a state setter is missing from an intermediate component’s action props.
- Preserve the schedule’s full day/time entries through normalization, add/remove, save, export, and import; the regression suite is designed around this.
- Scope claims in dashboards. City reference count, schedule count, area labels, unique coordinates, and row counts are not interchangeable.
- Keep source statuses, review statuses, and human confirmation separate.
- Phone field work must be saved continuously because mobile browsers can suspend/reload tabs. The same-origin browser store does not sync to another device or hostname.
- The owner gives specific corrections when visual output diverges. Re-check the screenshot and actual source before making another interpretive pass.

## 25. Feature Inventory

| Feature | Status | Purpose/current behavior | Files and remaining limitations |
| --- | --- | --- | --- |
| Barangay directory and summary dashboard | COMPLETED | Browse barangays and review summary/confirmation/activity data from selected JSON. | features/barangays/ and features/dashboard/; no structured report comparing practices. |
| Site map and pin CRUD | COMPLETED | Inspect/edit/create/delete site pins and details. | features/barangay-review/; confirm UI behavior manually for high-impact changes. |
| Firing-line editing | COMPLETED | Draw/edit route nodes, change names/notes, use coordinate or Maps links, and delete with confirmation. | FiringLinesCard.jsx, MapView.jsx, controller/actions; map UI needs normal browser QA. |
| GPS field capture | COMPLETED | Create pin at browser location, preserve accuracy/capture data, and recenter map. | Requires permission and HTTPS/localhost; reported precision is not a guarantee of exact placement. |
| Pickup/drop-off form | COMPLETED | One section per type, multiple days, optional typed time range, AM/PM controls. | ScheduleDayField.jsx, ScheduleTimeRangeField.jsx, pinFormHelpers.js; 6 regression tests pass. |
| Barangay name/purok/notes editing | COMPLETED | Update barangay-level details. | Last setter wiring fix is 2aa4b6a; manually verify the hosted app if this exact path matters. |
| Browser JSON workspaces, import/export | COMPLETED | Import raw arrays/review exports, separate each browser-local workspace, export changes. | No automatic device/cloud sync. The barangay output folder is an import source, not an auto-loader. |
| Activity/review history and field-session restore | COMPLETED | Keep review edits/history and resume page/map/drafts after reload on the same origin. | Browser-local only; export before clearing site data or changing browser/origin. |
| Barangay map filters | PARTIALLY IMPLEMENTED | UI has Purok, Site status, and Review selectors. | Currently disabled visual placeholders; do not claim filtering works. |
| Embedded Street View | PARTIALLY IMPLEMENTED | In-app panorama editor can help refine locations. | Needs a restricted Google Maps JavaScript API key and coverage varies; links/manual coordinates work without it. |
| Short Google Maps link resolver | COMPLETED in source | Expands Maps phone share links through local Vite/Cloudflare Pages endpoint. | Latest production deployment including the function is UNKNOWN in this handoff. |
| Driver schedule/map demo | COMPLETED as prototype | Weekly schedule, v6 default, map editing, status/driver metadata, JSON import/export. | Separate from Barangay app; no database. |
| Schedule dashboard area coverage totals | PARTIALLY IMPLEMENTED | Coverage panel shows counts/daily values from fixed summary constants. | Conflicts with owner’s request for selected-JSON-driven values; values can be stale. |
| BWMS screen recreation | COMPLETED as demo | Nuxt/Vue mock screens with local in-memory records and CRUD/filter/export interactions. | No live BWMS integration or durable database; login route is not app authentication. |
| Schedule/site mapping pipeline | PARTIALLY IMPLEMENTED | Generates versioned datasets, map indices, and audits; unresolved areas remain for human review. | Continue from audit/research files; do not guess route assignments. |
| PWA/offline installation | REJECTED | PWA support was added historically and then removed. | Only legacy-service-worker cleanup remains; never treat this as an active requirement. |
| Vue/Laravel backend migration | PLANNED | Separate Phase 2 document proposes a DB-backed client/server version. | Not implemented; DB/auth choices and user authorization are absent. |

## 26. Current Implementation Status

- **Completed and verified in this checkout:** schedule editing logic is covered by six passing tests; the three web apps produce production builds; current source has the latest barangay details setter fix.
- **Completed in code but not browser/production verified here:** latest Barangay form behavior, the Pages Function on the deployed hostname, GPS capture on the owner’s phone, Maps share links on production, and session restoration in a live phone browser.
- **Partially implemented:** disabled map filters; optional Street View; schedule dashboard area counts that are static.
- **No active coding task is recorded after the latest bug fix.** The current request is account-migration handoff documentation.
- **Current Git state before handoff edits:** main at 2aa4b6a, in sync with origin/main, clean.
- **Deployment status:** prior conversations indicate Cloudflare Pages production was configured for main and the owner pushed the latest code. The exact current production SHA was not checked as part of this handoff; verify it before promising that a given fix is live.

## 27. Known Bugs and Limitations

No unresolved user-reported bug after the final barangay-details setter fix is visible in accessible history. That is not proof the application has no bugs.

Known limitations:

- The Barangay map filter controls are disabled placeholders.
- locations/demo/site schedule demo/src/data/dashboardSummary.js hard-codes area and daily summary counts. The owner previously asked for the dashboard to follow the active JSON.
- Local storage is subject to per-origin/browser/device scope and browser storage limits; no sync exists.
- The Pages Function is required for short Maps share links in production.
- Vite builds warn that the minified JavaScript chunk is over 500 kB.
- Embedded Street View depends on a valid, restricted API key and available coverage.
- Some source sites have no coordinates. The current bundled source has 670 rows across 129 barangays and 7 records without coordinates.
- Schedule/mapping records remain uncertain in places. The old data handoff and audit files retain unresolved mapping details.
- The schedule demo README and root README still say v5 is default and describe only v3–v5, while current source bundles v3–v6 and selects v6. Treat current code as authoritative; this documentation drift is a known follow-up.

## 28. Technical Debt

- Derive remaining schedule dashboard area/daily summary counts from the selected schedule and map features or label them clearly as fixed reference values.
- Update stale schedule-version instructions in README.md, locations/README.md, and locations/demo/site schedule demo/README.md during a future documentation task.
- Add browser-level coverage for editable text fields, local session restoration, import/export, GPS fallback, and the production Maps resolver if/when test work is requested.
- Investigate Vite bundle splitting only if load performance becomes a problem; do not refactor only to suppress an advisory.
- No database, durable server-side backup, access control, or conflict resolution exists. The Phase 2 plan describes a possible architecture but leaves important choices open.
- Confirm whether the duplicate root/demo Pages Function wrappers are still needed after the Cloudflare Pages root is stable; do not remove them without verifying deployment settings.

## 29. Pending Features

### Owner-confirmed or documented next work

- The owner expected to review the prototype manually on a phone after deployment. The accessible history does not confirm whether that review has been completed.
- Schedule dashboard data-driven area totals are a previously requested behavior that remains incomplete in current source.

### Roadmap proposals, not confirmed commitments

- Improve search and detection of incomplete/duplicate site records.
- Add useful filters for purok, schedule, status, and follow-up.
- Improve review cleanup and portability.
- Consider stable IDs or shared storage/connections only when the dataset and workflow are ready.
- Phase 2 Vue/Laravel/database migration.

For any new implementation, acceptance should be written against the actual workflow and sample data. Do not infer City or barangay approval from a build or local editing behavior.

## 30. Deployment and Infrastructure

### Barangay Sites app

The deployment guide specifies Cloudflare Pages with:

- Root directory: locations/demo
- Build command: npm run build:barangay-sites
- Output directory: barangay sites demo/dist
- Pages Function: locations/demo/functions/api/resolve-google-maps-link.js

Deploy through the connected Git repository or Wrangler so the Pages Function accompanies the static app. A static folder upload alone does not create the API endpoint. The stable URL used in conversation is https://waste-sites-route-desk.pages.dev/.

The app needs HTTPS for GPS. It uses no login or server-side data store; each browser keeps its own review copy. The last live deployment SHA is UNKNOWN as of this handoff.

### Local development

Requires Node.js 20.19+ or 22.12+ and npm. From repository root:

~~~powershell
cd "locations/demo"
npm install
cd "barangay sites demo"
npm run dev
~~~

The schedule demo uses the same shared install. See [locations/demo/README.md](<locations/demo/README.md>).

For the BWMS clone, run from its directory:

~~~powershell
cd bwms-clone
npm ci
npm run dev
~~~

Open the URL printed by Vite/Nuxt. Vite binds to loopback by default; for phone GPS testing, prefer the hosted HTTPS URL. .env.example documents the optional Google API key. Never commit a real .env file or credential.

## 31. Testing and Validation

Current test infrastructure:

- From locations/demo/barangay sites demo/, run npm run test:schedules.
- The test file is scripts/schedule-regression.test.mjs; it tests normalization, preservation of multiple days and typed time input, and all 670 source rows surviving save/export/reimport.
- Each web app has npm run build; the shared locations package offers npm run build:site-schedule and npm run build:barangay-sites.
- The root has no unified test runner. BWMS has a build but no dedicated automated test script.

Checks completed for this handoff on 2026-10-28:

- Barangay schedule regression suite: 6 passed, 0 failed.
- Barangay Sites production build: passed; Vite large-chunk advisory.
- Driver Schedule production build: passed; Vite large-chunk advisory.
- BWMS Nuxt production build: passed; emitted a Vue package-resolution deprecation warning.
- Source dataset count check: 670 rows, 129 barangays, 7 missing coordinate pairs.
- Review export check: Oct 27 file parses and contains 129 barangays and 660 runtime pins, with sourceRowCount 670.
- Git status and source file references inspected.

No phone browser/manual interaction test, Cloudflare dashboard check, or live production SHA check was performed for this handoff.

## 32. Development Workflow

1. Read AGENTS.md, this file, and NEXT_STEPS.md.
2. Check git status --short, branch, and current commit before touching anything.
3. Read relevant local docs and current source. Inspect current UI if the owner provides a screenshot.
4. State assumptions and preserve unrelated edits/data. Keep code modular and follow existing patterns.
5. Make the smallest change that solves the requested behavior. Do not introduce a migration or dependency without need.
6. Run targeted existing tests/builds when the user asks for implementation verification; report warnings and limits.
7. Update continuation/handoff docs after substantial work.
8. Before a commit/push/deploy, check exactly what will be published and obtain explicit owner authorization unless that authorization is already clear in the current request.
9. Report actual changed files, validation results, unresolved risks, and whether the change is only local or deployed.

## 33. Unresolved Questions

- Has the owner completed the requested phone review of the latest deployed Barangay app?
- Does Cloudflare production currently serve commit 2aa4b6a and the Pages Function?
- Should schedule dashboard area totals be fixed now, and what data source is the authority for intended reference totals?
- The owner specified assigned-purok and site-status filters on 2026-10-29; these are implemented locally. Any additional filter semantics remain unspecified.
- Is remote shared storage or multi-user collaboration desired? Current owner preference is personal field use; no backend authorization has been specified.
- If Phase 2 proceeds, which database, deployment target, authentication/authorization model, and import conflict rules should it use?
- Is the remembered swimlane visual specification intended only for the report, or for future diagrams too? It should not be applied to the app theme without direction.

## 34. Future Roadmap

ROADMAP.md orders product work as:

1. Fast phone field capture — implemented in the prototype; manual phone review remains unconfirmed.
2. Organize the growing site record set — search, incompleteness/duplicate awareness, and robust backup/import/export.
3. Review and clean collected data — filters, correction workflows, and history.
4. Add sharing or operational connections only when needed and after data readiness.

The Phase 2 migration document is separate: a Vue frontend plus Laravel API/database while preserving the React prototype until parity and data round-trip checks pass. It is planned, not implemented or authorized by this handoff. No roadmap dates are committed.

## 35. Instructions for the Next AI Agent

- Start with AGENTS.md, PROJECT_HANDOFF.md, NEXT_STEPS.md, then linked README/architecture notes and source for the feature being changed.
- Treat the Barangay Sites React/Vite app as the active product unless the owner says otherwise.
- Keep the phone-first field workflow, two schedule sections, current confirmation control, data portability, and modular code structure.
- Do not re-add PWA support, overwrite source data, remove review exports, or introduce cloud sync/Phase 2 without explicit owner direction.
- Distinguish candidate/unknown mappings from confirmed facts and explain count scope.
- Verify the actual UI interaction, not only the build, for bugs involving controlled inputs.
- Tell the owner when a change is local only and when it has or has not been deployed.
- Treat inaccessible prior conversations as unknown; this handoff captures only sources available on 2026-10-28.

## 36. Evidence and Source References

### Repository evidence

- [README.md](README.md) — project overview and run instructions.
- [ROADMAP.md](ROADMAP.md) — current product direction and staged improvements.
- [HANDOFF.md](HANDOFF.md) — earlier Barangay app handoff, updated 2026-10-26.
- [locations/README.md](<locations/README.md>) and [locations/HANDOFF.md](<locations/HANDOFF.md>) — data workflows and historical v3 mapping review; locations/HANDOFF.md is dated 2026-10-16 and is not current app status.
- [Barangay demo README](<locations/demo/barangay sites demo/README.md>), [deployment guide](<locations/demo/barangay sites demo/DEPLOYMENT.md>), and [Phase 2 plan](<locations/demo/barangay sites demo/PHASE_2_SERVER_CLIENT_MIGRATION.md>).
- [Schedule demo README](<locations/demo/site schedule demo/README.md>) and current source under locations/demo/site schedule demo/src/.
- Git log from 099fed9 through 2aa4b6a; latest source commit is 2aa4b6a.
- locations/data/jsons/barangays/barangay_sites_v2.json, the Oct 27 review export, schedule versions v3–v6, and CSV mapping/audit files.
- [Case analysis](Waste_Collection_Optimization_Case_Analysis.docx), Baguio_Waste_Collection_Story_v3.pptx, output/Baguio_Waste_Collection_Story_v4.pptx, and [GSO questionnaire draft](<locations/questionnaire/GSO_site_schedule_questionnaire_draft.md>).

### Accessible conversation evidence

Relevant accessible Codex conversations included “Create barangay sites demo prompt,” “Refine driver schedule JSON prompt,” “Drver Site UI,” “Drver Site UI 2,” “Verify barangay waste collection,” “Keep phone session from resetting,” “Assess barangay data collection demo,” “Fix barangay and firing line editing,” and “Manage Git updates.” These provided owner intent/corrections not fully represented in Git. Their complete transcripts are not copied into this repository.

### Limits of evidence

No unavailable or unlisted conversation is presumed accessible. No live Cloudflare account inspection was performed here. The new handoff files should be refreshed as decisions and implementations change.

## 37. Last Updated Date

2026-10-29 (Asia/Manila). The 2026-10-28 handoff history above is retained; see section 38 for the latest local implementation and verification limits.

## 38. Local Barangay Sites UI Update — 2026-10-29

- **Owner request:** selected-pin details show name, assigned purok, coordinates, Pick-up and Drop-off schedule, Barangay confirmed status, remarks, and review note. The selected card no longer shows source record count, raw purok text, source aliases/status heading, or status date. The underlying source/review JSON fields remain intact.
- **Owner request:** the map filters now use assigned purok and site status type; they narrow both markers and the pin list. Unassigned purok and missing status are selectable. The separate Review placeholder was removed. The map count reflects filtered pins, while the barangay summary retains total counts. Filter selections save with the browser field session.
- **Owner request:** firing lines now use the existing single Pick-up/Drop-off schedule editor, with independent day rows, optional typed times, and a line-level Barangay confirmed toggle. These values display in the selected-line card and save in browser review state and exported JSON. Old imported lines without these fields default to blank schedule and unconfirmed. Disconnecting a line retains the draft schedule on both segments and clears confirmation for fresh review.
- **Checks completed:** `npm run test:schedules` passed 7/7, including a new firing-line save and JSON reimport case. `npm run build` passed and reported the existing Vite JavaScript chunk over 500 kB advisory. `git diff --check` reported no whitespace errors; Git emitted only line-ending conversion notices.
- **Checks still needed:** a real browser interaction and mobile layout review for filters, selected-pin card, and firing-line editor. The in-app browser timed out on the local preview and the computer-use request for Chrome was automatically denied. No Cloudflare production check, phone GPS test, commit, push, or deployment was performed.

