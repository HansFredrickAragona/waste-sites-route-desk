# Barangay sites demo

A React, Vite, and Leaflet app for collecting and reviewing Baguio City collection-site data by barangay. It loads its source records from `locations/data/jsons/barangays/barangay_sites_v2.json` and keeps edits in the browser until they are exported.

## Phase 2 plan

The proposed second phase moves saved data and review rules to a Laravel API and database, and migrates the frontend from React to Vue. See the [Phase 2 server-client and migration plan](PHASE_2_SERVER_CLIENT_MIGRATION.md). This is a plan; the current prototype remains React/Vite with browser-local persistence. Phase 2 implementation will use a separate Git branch and separate folders so this demo keeps its current `npm run dev` workflow and dependencies.

## Start locally

Requires Node.js 20.19+ or 22.12+.

From this folder, install the shared dependencies once (repeat only if dependencies change):

```bash
npm install --prefix ..
```

Then start this demo from this folder:

```bash
npm run dev
```

Open the local URL printed by Vite (normally <http://127.0.0.1:5173>).

## Source organization

- `src/app` composes the application and connects feature data to the page components.
- `src/layouts` contains the shared header and navigation.
- `src/features/barangays`, `src/features/barangay-review`, `src/features/activity-log`, and `src/features/dashboard` hold their own UI and workflows. Barangay-review actions and controller state live alongside that feature.
- `src/features/json-library` owns JSON import/export actions and browser persistence.
- `src/shared/ui` contains reusable primitives such as dialogs and metric cards; `src/shared/utils` contains shared formatting helpers.
- `src/styles/global.css` contains the app-wide styles; `src/main.jsx` is the Vite entry point.

## Review workflow

- The barangay list shows the number of mapped site records and each barangay's confirmation status. Open a row to review its map.
- Select a site to inspect its source status, coordinates, pickup/drop-off day and time, remarks, and purok. Each site has one Pick-up section and one Drop-off section. Add day rows independently, type start/end times, and choose AM or PM; times are optional. Older schedules with multiple groups are combined into these two sections. Records with no coordinates remain in the list and can be mapped by editing the site and entering coordinates or a Google Maps link. Choose **Add GPS pin** to create a pin from your device's GPS, or choose **Add pin** and click the map to place it manually. GPS pins save latitude, longitude, capture accuracy, and a Google Maps link. The floating target button recenters on your current GPS position; a second map button returns to the selected pin or, when none is selected, shows all mapped pins. Existing mapped pins can be edited by form or by dragging the highlighted pin. Puroks can be selected from saved suggestions or entered directly.
- Add a firing line, click its path nodes, and finish the line with a double-click or **Finish line**. While editing a line, select a blue node to open its Google Street View link, move it by dragging or pasting coordinates, add nodes after it, or delete it when at least two nodes will remain. Save the line to record node and line changes.
- Use the barangay-level confirmation switch after the local review. The pin editor has its own **Barangay confirmed** toggle without a separate Site confirmation heading. Site remarks and review note appear side by side on wide screens and stack on phones. Purok and barangay review notes are saved under **Update barangay details**.
- The activity log records barangay, pin, firing-line, import, and confirmation changes.
- **JSON in use** selects the active dataset. **Add JSON** accepts one or more raw site-record arrays (such as `barangay_sites.json` or `barangay_sites_v2.json`) or review exports. Each added file becomes its own selectable workspace, with edits saved separately in this browser.
- The active field session saves automatically in this browser, including the current barangay, map position, unfinished pin or firing-line edits, and pasted Maps location text. Returning from Google Maps or reopening the app resumes that work. **Reset session** clears the current place and unfinished edits while keeping saved review changes.
- **Delete JSON** removes the selected workspace and its browser-saved edits from the selector. This only removes the copy from this browser; the original file on disk remains. The bundled dataset can also be removed from the selector. If the last JSON is deleted, the dashboard and barangay list remain available with empty data; add a JSON to start again.
- **Export JSON** downloads the active review copy, including barangays, pins, firing lines, confirmations, and activity history. Pin and firing-line deletion remains scoped to the active workspace.
- The dashboard summarizes barangays, distinct mapped locations, confirmations, purok coverage, map distribution, and recent activity.

Map filters on the barangay map are visual placeholders. Map tiles require an internet connection; visible attribution is included. To use another compatible tile service, set `VITE_MAP_TILE_URL` in an `.env` file to a `{z}/{x}/{y}` URL template.

Current-location capture requires browser location permission and a secure page (HTTPS or localhost). On a phone, opening the app from a laptop's local network IP over HTTP is not secure, even when browser permission is allowed. The app tries precise GPS first and then a faster, less precise location method if GPS is unavailable; it shows the reported accuracy so you can check the pin before saving. The app builds a Google Maps link from the saved coordinates and does not need a Google Maps API key for this flow. When editing a pin or firing-line node, the Google Maps link opens that location in Street View and the coordinate field accepts a full Maps URL, a phone share link such as `maps.app.goo.gl`, or latitude and longitude. Applying coordinates moves the draft location on the map; save the pin or firing line to record the change. Short Maps links are expanded by the local Vite endpoint or Cloudflare Pages Function. To navigate an embedded Street View panorama in the editor, copy `.env.example` to `.env.local`, set `VITE_GOOGLE_MAPS_API_KEY`, enable the Maps JavaScript API with billing for that key, and restart Vite. Restrict the key to the Maps JavaScript API and this demo's website referrers. The link and coordinate paste work without an API key.

## Bundled sample data

The app reads the raw barangay site records directly from `../../data/jsons/barangays/barangay_sites_v2.json`. It groups records by barangay, retains each source schedule, status, remarks, and raw purok value, and starts each barangay unconfirmed. Per-site review data stores only the confirmation flag; legacy change-status and review-date fields in imported files are ignored. Seven source records currently have no coordinates; they stay available in the site list and can be mapped during review. Purok choices are prefilled only when the source has an explicit `Purok N` label.

Review edits are saved to the browser's local storage. Export a JSON copy before switching browsers or clearing site data.
