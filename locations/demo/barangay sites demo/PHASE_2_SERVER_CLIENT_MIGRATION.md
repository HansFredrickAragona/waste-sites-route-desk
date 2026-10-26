# Phase 2 — Server-client architecture and framework migration

**Status:** Planned; not implemented. The current demo is a React/Vite frontend that stores review work in the browser and exports JSON.

## Goal

Turn the Barangay Sites UI into a client-server app. Migrate the frontend from React to Vue, add a PHP Laravel backend, and move the authoritative site data from JSON/browser storage into a relational database. Keep the map review workflow and v2 JSON import/export available during and after the migration.

## Target responsibilities

### Vue frontend

- Vue UI components render the barangay table, map, site editor, review history, and activity views.
- Frontend controllers/composables manage page state, selected barangay/site, map state, edit drafts, loading states, and error messages.
- An API client sends requests to Laravel and places returned data into frontend state.
- The frontend does not query the database or own durable review rules. It can show a draft, but the server response becomes the saved state.

### Laravel backend

- API routes and controllers receive requests, validate request shapes, and return consistent JSON responses.
- Services apply review rules, compare submitted site fields with saved values, and coordinate database transactions.
- Laravel models and the data layer query and update the database.
- The server owns durable data, change history, exports, and (when multi-user access is introduced) authorization.

## Data model

Use stable database IDs and foreign keys so each site belongs to one barangay. Preserve the imported source values and the existing v2 JSON contract.

| Table | Purpose |
| --- | --- |
| `barangays` | Barangay identity and barangay-level details/confirmation. |
| `sites` | Site name, barangay foreign key, coordinates, purok, remarks, notes, source `status`, and per-site review summary (`is_brgy_confirmed`, `change_status`, `last_reviewed`). |
| `site_schedules` | Pickup/drop-off schedule entries associated with a site, including day, time, and any source date values. |
| `logs` | Append-only site and review events, including event type, changed fields/action, timestamp, and optional actor. Site-edit history is read from these records. Confirmation-only changes must not be reported as pin edits. |
| `firing_lines` and `firing_line_nodes` | Existing map lines and their ordered coordinates, associated with a barangay. |

The precise database engine and any authentication approach remain to be selected before implementation. Do not conflate the CSV-derived site `status` with review `change_status`.

## Keep Phase 2 isolated

- Keep the existing React demo in `locations/demo/barangay sites demo` unchanged while Phase 2 is developed. It will continue to use its current dependencies and `npm run dev` command.
- Start Phase 2 on a separate Git branch, for example `codex/phase-2-vue-laravel`.
- Put the Vue client in a new sibling folder, for example `locations/demo/barangay sites demo-vue`, with its own `package.json` and Vite scripts. Its frontend can also use `npm run dev`; Vue replaces React-specific packages, while framework-neutral libraries such as Leaflet can be reused when compatible.
- Put the Laravel API in a separate backend folder, for example `locations/api/barangay-sites`. Run it with Laravel/PHP tooling such as `php artisan serve`; `npm run dev` starts the Vue development frontend, not the Laravel API.
- Do not change the current demo's dependency versions, scripts, or folder as part of the initial migration work. Consider switching the default demo only after the Phase 2 acceptance checks pass.

## Data flow

### Open a barangay from the table

1. The user selects a barangay row in the Vue UI.
2. The frontend controller selects the row and requests the barangay’s map data from Laravel, for example `GET /api/barangays/{barangay}/map`.
3. The Laravel controller delegates the request to the data/service layer, which queries the barangay, sites, schedules, and firing lines.
4. Laravel returns a JSON response. The frontend controller updates its state and passes the data to the map components.
5. The UI renders the sites as pins and firing lines as map overlays. It can highlight the selected row while the request is loading.

### Save a site edit

1. A Vue form updates the frontend edit draft.
2. On save, the frontend controller sends the edited fields to an endpoint such as `PATCH /api/sites/{site}`.
3. Laravel validates the request and, in one database transaction, compares the submitted fields with the current site values.
4. If site fields changed, Laravel updates the site, sets `change_status` to `changed`, sets `last_reviewed`, and appends one `logs` record containing the changed fields and their new values. Existing logs and the source `status` fields are preserved.
5. If no site fields changed, Laravel creates no site-edit history entry and leaves `change_status` and `last_reviewed` untouched.
6. A confirmation-only request changes `is_brgy_confirmed`; it does not create a pin-edit history entry.
7. Laravel returns the updated site and its review history. The frontend controller replaces the saved UI state with that response.

### Export v2 JSON

Laravel builds an export from the database, including barangays, sites, source `status`, schedules, map features, confirmations, and review history. The export formatter maps `logs` into the v2 `review.change_history` shape (`date` and `action`). The browser downloads this server-generated JSON. Importing an export should preserve IDs where valid, status data, and all prior history.

## Migration sequence

1. **Freeze the contract:** document v2 field names, stable IDs, date/time format, history action format, and API request/response examples.
2. **Create the Laravel backend:** add database migrations, models, validation, transaction-backed save rules, read endpoints, and JSON import/export endpoints.
3. **Import existing data:** build an idempotent importer for `barangay_sites_v2.json` and existing review exports. Report invalid rows and verify barangay/site counts, coordinates, schedules, source status, and review history before cutover.
4. **Build the Vue client:** recreate the current list-to-map and edit workflows in Vue. Put HTTP calls in a small API client and keep screen state in frontend controllers/composables.
5. **Verify parity:** exercise barangay selection, site editing, no-op saves, confirmation-only changes, history preservation, firing lines, reloads, and v2 export/import round trips against the database-backed app.
6. **Cut over:** after the data round-trip and workflow checks pass, decide whether to make the Vue/Laravel app the active demo. Keep an exported backup of the current browser-local review data; retain the React prototype until the new app is accepted.

## Phase 2 completion criteria

- The Vue app reads and writes review data through Laravel endpoints.
- The database is the source of truth; reloads and a second authorized client see the saved values.
- Site edits, no-op saves, confirmation toggles, source status preservation, and history follow the rules above.
- Existing map features and schedules survive import and export.
- v2 JSON exports retain the agreed structure and can be imported without losing review history.
- The React/local-storage prototype remains available until these checks pass and the migration is accepted.
