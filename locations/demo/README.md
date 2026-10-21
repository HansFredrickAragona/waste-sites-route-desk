# Driver schedule demo

A small React + Vite prototype that reads its own copies of `driver_schedule_v3.json`, `driver_schedule_v4.json`, and `driver_schedule_v5.json` from `public/data/schedules/`. The source JSON files in `../data/jsons/schedules/` are left untouched. Its barangay list and site index in `public/data/maps/` are derived from the raw SWMD map CSV.

Requires Node.js 20.19+ or 22.12+.

## Start locally

From this folder, install the demo dependencies once and start Vite:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally <http://127.0.0.1:5173>).

The selector lists bundled v3, v4, and v5 schedules separately. Selecting a file loads only that schedule. The shared SWMD site index is used for site and barangay map/filter references. Use **Add JSON** to add one or more schedules; each appears by its filename and is loaded independently. Uploaded schedules are saved in this browser's local storage, so you can switch between them and the bundled files without changing the source JSON files. The app does not upload the JSON; map viewing still requests tiles from the configured tile provider. Invalid files are skipped with an explanation.

In v4, each schedule day uses the original `area` array. Each record keeps its `area_name`, `barangay`, `sites`, and `pick up time`. Unmapped routes retain their original `firingline` or blank site entries with null coordinates. The weekly table reads the exact day area name from `src/data/schedules/cleanedDriverAreaLabels.json`, generated from `cleaned_drivers_dataset.csv`, and shows a compact site and mapping summary. The prototype also accepts the later nested `area: { name, details }` shape in browser-saved copies. The map filters by barangay and plots only sites with coordinates.

In v5, each day uses `area: { name, details }`. `name` is the day collection label from the cleaned driver dataset. `details` groups confirmed sites by barangay, keeps original source fragments in `source_areas`, and records unmapped fragments in `unmapped_segments`. Confirmed sites carry their SWMD `source_csv_row`. Celestial Village row 27 is mapped to the Celestial-to-Belshang assignment; the remainder of that route is still marked unresolved. QRT days use `name: "QRT"` and `type: "relief"`; the original cleaned label and source details are retained for reference. Selecting a QRT cell opens a searchable list of unique mapped pins from other scheduled assignments, with the prior driver, day, and area shown for each pin.

The demo opens on v5 by default for a new browser session. Use the **Driver** filter to narrow the weekly table. Click a populated day cell to open its assigned sites. The map filter lists the barangays assigned to that day, including **All barangays**, and uses each site's assigned barangay rather than all coordinate aliases. The cleaned day area name is shown above the map filter as context. The Data Notes card sits above the schedule; the table is outside that card. The map bar groups the pin count with the map actions and selected-cell Data Notes, including area assignments, site-coordinate issues, and whether firing lines or bounded areas are defined. At the bottom of the map, use the cell review switch to mark the selected driver/day confirmed or not confirmed. Confirmed cells show a check in the weekly table.

Click a pin to view its details; choose **Edit pin** to change its name, map label, barangay, or coordinates. A pin can move only while it is in edit mode. Save pin opens a review card; choose **Confirm and save pin** to apply the changes, or go back and edit. Cancel discards them. The **Add collection pin**, **Add firing line**, and **Add bounded area** actions sit beside the assigned details at the top of the map. Choose a **Pin assignment**, click **Add collection pin**, then click the map to place a draft. Fill in its details and confirm it in the side panel to save. Firing lines and bounded areas are separate map features. Deleting a pin or firing-line feature requires confirmation.

Changes are saved as a browser-local working copy for the selected schedule and remain after reload. **Export new JSON** downloads a new numbered file such as `driver_schedule_v6.json`; it never writes to a bundled schedule file. Exported files use an object with a `schedule` array, a separate `map_features` array, and `cell_statuses` for confirmation states. Re-upload an exported file with **Add JSON** to continue editing it. Firing lines and bounded areas are stored in `map_features` as `firing_line` and `bounded_area` feature types, separate from site records.

Select a pin, choose **Edit pin**, and open the in-app Street View viewer to navigate to a verified location. The latitude and longitude fields follow the panorama; choose **Save pin** to review the update, then confirm it in the side panel. Export a new JSON file to carry it elsewhere. Google Maps requires a Maps JavaScript API key for the embedded viewer: copy `.env.example` to `.env.local`, set `VITE_GOOGLE_MAPS_API_KEY`, enable the Maps JavaScript API with billing on its Google Cloud project, and restart the demo. Restrict the key to the Maps JavaScript API and the demo's allowed website referrers. Without a key, the Google Maps link and manual coordinate/link paste workflow remain available. Street View coverage varies by location.

To remove the selected schedule from this browser's selector, choose **Delete JSON** and confirm in the card. Uploaded schedules are removed from browser storage; bundled schedules are hidden from the selector. No source JSON files are deleted from disk. Choose **Restore bundled** to show them again.

To create a production build, run `npm run build`.

If the raw SWMD map changes, regenerate the demo's barangay/site index and v3 comparison reports from this folder with `npm run data:refresh`. The index includes all source coordinates and excludes points marked `Removed collection point` from active maps. The reports compare every distinct v3 `area.barangay` label with canonical names in the SWMD CSV and map labels to barangays by coordinate. They are shown only when v3 is selected.

The map uses OpenStreetMap tiles and needs an internet connection. Tile requests are limited to the map currently in view, and visible map attribution is included. To use another compatible tile service, set `VITE_MAP_TILE_URL` in a `.env` file, using a `{z}/{x}/{y}` URL template.
