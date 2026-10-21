# Baguio location demos

This folder contains two demos that use one shared npm installation:

- `site schedule demo` — the driver schedule and collection-site planning demo.
- `barangay sites demo` — the barangay collection-site verification demo.

## Install once

From this folder, run:

```bash
npm install
```

This installs the dependencies for both demos in this folder's `node_modules`. Run it again only if the dependencies change.

## Start a demo

After the shared install, change into either demo folder and run its existing script:

```bash
cd "site schedule demo"
npm run dev
```

Or:

```bash
cd "barangay sites demo"
npm run dev
```

You can also start either demo from this folder with `npm run dev:site-schedule` or `npm run dev:barangay-sites`.
