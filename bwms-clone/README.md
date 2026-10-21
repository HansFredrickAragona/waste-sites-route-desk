# Baguio Waste Management System clone

A Vue and Nuxt recreation of the signed-in Baguio Waste Management System test interface. It opens directly on the dashboard; there is no login screen.

[Whole project](../README.md) · [Collection locations and map demo](../locations/README.md)

## Run locally

Use Node.js 22.12+ and npm. From the repository root:

```bash
cd bwms-clone
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`.

## Production build

From `bwms-clone`:

```bash
npm run build
npm run preview
```

The app needs no environment variables or service credentials for its current demo behavior. Generated `.nuxt/` and `.output/` folders, dependencies, and real `.env` files are ignored by Git.

## Included sections

- Dashboard summary and trend charts
- City collection schedules and biodegradable records
- City waste reports, drivers, vehicles, and collection sites
- Private hauler reports, companies, and vehicles
- Junkshop reports, companies, vehicles, and recyclable categories

## Code layout

- `pages/` contains one Nuxt route file for each screen.
- `components/ManagementPage.vue` renders the shared record-management interface.
- `composables/useManagementPage.ts` handles record creation, editing, departure, and deletion.
- `composables/useRecordFilters.ts` handles search, date/source filters, sorting, and pagination.
- `data/page-configs/` keeps each screen's columns, form fields, and demo records in its own module.
- `data/pages.ts` combines page definitions and navigation links.

The clone uses local demonstration records and does not connect to the Baguio test service. Add, edit, delete, search, filter, sort, pagination, and CSV export work in the local interface. Record changes are held in app state for the current browser session.

On City Waste Reports, plate number and truck weight are required. Collection sites are optional. The assigned driver and tare weight come from the selected city vehicle. Arrival time is captured when the record is saved; use the row's **Depart** button to capture departure time and complete the trip. Click a row to view details, then edit timestamps or delete the record from the details panel.
