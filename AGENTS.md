# AI AGENT OPERATING INSTRUCTIONS

These instructions apply to this repository only: the Baguio waste-sites and route-desk project.

## Project Identity

This repository contains CSV/JSON preparation for Baguio City waste collection sites and driver schedules, a current personal field-review web app, a separate driver schedule/map prototype, a separate BWMS screen recreation, and related analysis/presentation artifacts. The active product is the Barangay Sites app at **locations/demo/barangay sites demo/**. It is a React/Vite/Leaflet app that stores review data in each browser and exports JSON. It is not a live City service and has no account system, shared database, or cross-device sync.

## Mandatory Reading

Before substantial development work, read:

1. [AGENTS.md](AGENTS.md)
2. [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)
3. [NEXT_STEPS.md](NEXT_STEPS.md)
4. Relevant architecture/data notes, such as [ROADMAP.md](ROADMAP.md), [locations/README.md](<locations/README.md>), the relevant demo README, deployment guide, or migration plan
5. The relevant source files and data schema/generator

When a relevant README conflicts with current code, verify the current source and document the discrepancy. At handoff, schedule README files describe a v5 default, while the schedule app bundles v3–v6 and defaults to v6.

## Owner Preferences

- Work on the requested behavior in the existing app; keep the schedule and barangay demos separate.
- Keep code modular, with focused components and data helpers. The owner explicitly rejected putting the whole app in one file.
- Preserve original data and create versioned output when transforming schedules or maps.
- Keep labels/counts honest: distinguish city reference counts, selected-schedule counts, area labels, unique coordinates, source status, review status, and human confirmation.
- Respect the phone field workflow and use a compact, responsive interface. The owner no longer wants PWA installation/offline behavior.
- Follow screenshots and specific corrections closely; the owner has corrected label, spacing, grouping, and control-retention mistakes.
- Report assumptions, checks, warnings, and whether a change is local or deployed. The owner has used an explicit confirm-before-push workflow.

## Nonnegotiable Requirements

- Preserve source schedule/site fields, names, times, unresolved values, and review history unless the owner specifically directs a data change.
- A site has one Pick-up section and one Drop-off section. Each section allows multiple day rows; times are optional typed values with AM/PM controls.
- Do not invent coordinates, route assignments, schedules, or confirmation. Leave uncertain data reviewable.
- Site source status and review/confirmation status must remain separate.
- Keep barangay-level notes, site remarks, and review notes as distinct contexts.
- The review JSON in **locations/data/jsons/barangays/output/** is importable via Add JSON and is project data. It is not an automatically loaded folder, but it is not disposable build output.
- Browser persistence is per browser/device/origin. Export JSON before any step that could clear site data or move data between origins/devices.
- Keep user data and credentials out of commits. A VITE-prefixed Google Maps key is exposed to the browser and must be restricted. Never commit a real .env.

## Prohibited Changes

- Do not restore PWA manifest, service-worker installation, offline behavior, install icons, or PWA setup unless the owner explicitly reverses their decision.
- Do not overwrite source CSVs, original JSON, or bundled schedule versions as a convenience. Check generator output paths before running it.
- Do not delete review JSON exports or clean up output folders without checking each file and owner intent. Four older Barangay review exports were intentionally deleted in the Oct 27 history; preserve the remaining Oct 27 review JSON.
- Do not remove the Barangay confirmed toggle when changing its redundant heading.
- Do not reintroduce the removed vague-area card/filter in the schedule dashboard without a new request.
- Do not start the Vue/Laravel Phase 2 migration, add cloud sync/auth, or replace the React app without current owner direction.
- Do not push, publish, or deploy unless the owner has explicitly authorized that action. A build passing is not authorization and does not prove deployment.

## Architecture Rules

- The two map demos share dependencies installed from **locations/demo/package.json**, but are separate apps with separate state/data copies.
- The Barangay app’s entry/composition is in **locations/demo/barangay sites demo/src/**; use existing feature/action/controller boundaries.
- **reviewRepository.js** owns JSON normalization and browser persistence; prefer its existing interfaces rather than introducing a second storage path.
- Source input is **locations/data/jsons/barangays/barangay_sites_v2.json**. The app saves review state in localStorage and exports a review JSON; it does not edit that source file.
- The Pages Function for production short-link resolution lives under **locations/demo/functions/**. Local resolution also uses Vite middleware. The function must deploy with the site.
- The driver schedule demo has separate public copies of schedule versions v3–v6. Avoid treating schedule version shapes as interchangeable.
- **bwms-clone/** is an independent Nuxt/Vue mock using local demo records; do not connect it to locations data unless asked.
- Do not infer that a file under **output/** is generated/disposable solely from its folder name. The root output folder and **locations/data/jsons/barangays/output/** serve different purposes.

## Development Workflow

1. Inspect Git status, branch, and latest commit.
2. Read relevant docs, code, and data before proposing a replacement.
3. Reproduce the behavior where possible, especially for a reported UI/input bug.
4. Make a focused change that preserves unrelated features and local/user data.
5. Run targeted existing tests/builds when verification is requested; do not add a dependency or broad test harness for a small fix.
6. Review the diff and warnings; check documentation if behavior or architecture changed.
7. Before any commit/push/deployment, verify what will be published and obtain authorization unless the current request already clearly authorizes it.

## Testing Requirements

The existing targeted regression suite is in **locations/demo/barangay sites demo/scripts/schedule-regression.test.mjs**. Run it from that folder with **npm run test:schedules**. It protects the one-pickup/one-drop-off schedule model and data preservation.

Build a relevant app with **npm run build** from that app folder, or use the shared locations/demo scripts. The Vite demos currently warn about a JavaScript chunk over 500 kB. The BWMS build can emit a Vue package-resolution deprecation warning. Report these accurately.

Do not claim browser interactions or deployment behavior were verified from a successful build alone. Test the real form/flow or state the limitation.

## Communication Guidelines

- Give short progress updates during sustained work.
- State confirmed facts, assumptions, and unknowns separately.
- For a visual correction, name the exact retained/removed controls and layout. Do not reinterpret ambiguous screenshots without checking the rendered result.
- Report changed files, checks performed and not performed, warnings, and whether the result is only local or deployed.
- Do not invent prior decisions. The repository handoff captures only accessible history and current files.

## Documentation Maintenance

At the end of every substantial development session:

1. Update NEXT_STEPS.md with completed work, current status, blockers, and next tasks.
2. Update PROJECT_HANDOFF.md when requirements, architecture, decisions, limitations, or owner preferences change.
3. Preserve historical context when decisions evolve; mark old decisions as superseded instead of erasing them.
4. Never mark unverified behavior as completed.
5. Keep documentation aligned with current code and data; call out unresolved documentation drift.

## Project Continuity

Assume every new AI session starts without conversation memory. Use these repository files as the durable handoff. If a historical claim is not supported here or in accessible project evidence, mark it unknown and ask only when it matters to the requested work.

