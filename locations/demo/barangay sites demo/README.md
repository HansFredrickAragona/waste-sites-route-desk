# Barangay sites demo

A React, Vite, and Leaflet prototype in the shared collection-demo folder for reviewing Baguio City collection-site map data with barangay officials. It starts with a bundled copy of the SWMD map snapshot and keeps edits in the browser until they are exported.

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

## Review workflow

- The barangay list shows the number of mapped site records and each barangay's confirmation status. Open a row to review its map.
- Select a pin to inspect its source labels, coordinates, source-row count, and purok. Add a pin by choosing **Add pin** and clicking the map. Existing pins can be edited by form or by dragging the highlighted pin. Purok choices come from **Update barangay details**.
- Add a firing line, click its path nodes, and finish the line with a double-click or **Finish line**. While editing a line, select a blue node to open its Google Street View link, move it by dragging or pasting coordinates, add nodes after it, or delete it when at least two nodes will remain. Save the line to record node and line changes.
- Use the barangay confirmation switch after the local review. Purok and review notes are saved under **Update barangay details**.
- The activity log records barangay, pin, firing-line, import, and confirmation changes.
- **Import JSON** accepts this demo's review export. **Export JSON** downloads a portable copy of all barangays, pins, firing lines, confirmations, and activity history.
- The dashboard summarizes barangays, distinct mapped locations, confirmations, purok coverage, map distribution, and recent activity.

Map filters on the barangay map are visual placeholders. Map tiles require an internet connection; visible attribution is included. To use another compatible tile service, set `VITE_MAP_TILE_URL` in an `.env` file to a `{z}/{x}/{y}` URL template.

When editing a pin or firing-line node, the Google Maps link opens that location in Street View and the coordinate field accepts a full Maps URL or latitude and longitude. Applying coordinates moves the draft location on the map; save the pin or firing line to record the change. Short `maps.app.goo.gl` links do not contain coordinates, so use the full Maps URL or enter the coordinates directly. To navigate an embedded Street View panorama in the editor, copy `.env.example` to `.env.local`, set `VITE_GOOGLE_MAPS_API_KEY`, enable the Maps JavaScript API with billing for that key, and restart Vite. Restrict the key to the Maps JavaScript API and this demo's website referrers. The link and coordinate paste work without an API key.

## Bundled sample data

`public/data/maps/swmd_site_index.json` is a snapshot copied from the driver schedule demo's SWMD site index. The app organizes its coordinate records under barangays, retains the source site labels and source-row counts, and marks source records as active or removed. Shared coordinates appear under each barangay they were associated with. The initial review starts unconfirmed, with no assigned purok unless the source provides an explicit `Purok N` value.

The Irisan map includes one clearly labeled **Example route segment** with a note asking officials to verify the path. It is an illustrative demo feature, not a route from the source export.

Review edits are saved to the browser's local storage. Export a JSON copy before switching browsers or clearing site data.
