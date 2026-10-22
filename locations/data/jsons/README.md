# JSON data folders

- `schedules/` contains the legacy driver schedules and versioned schedule JSON files. Keep each version as a complete JSON file so it can be selected or regenerated independently.
- `barangays/` contains `barangay_sites.json`, generated from the annotated SWMD sites CSV for the barangay sites demo.
- `maps/` contains the SWMD map JSON used by the data preparation scripts.
- `examples/` contains the `driver_format.json` example.

The schedule demo serves its own copies of v3, v4, and v5 from `demo/site schedule demo/public/data/schedules/` and its SWMD site index from `demo/site schedule demo/public/data/maps/`. The v4 and v5 generators write both source and prototype copies.
