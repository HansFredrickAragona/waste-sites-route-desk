import assert from "node:assert/strict";
import test from "node:test";
import { barangayCsvFilenames, firingLinesCsv, siteSummaryCsv } from "../src/features/barangay-review/utils/selectedBarangayCsv.js";

test("site CSV includes every saved pin and preserves schedule text and CSV quoting", () => {
  const barangay = {
    pins: [
      {
        name: 'Collection "A", north', purok: "Purok 1", latitude: 16.4, longitude: 120.5,
        googleMapsUrl: "", schedule: [
          { "pick-up": { day: "Thursday and Friday", time: "" } },
          { "drop-off": [{ day: "Monday", time: "5 PM" }, { day: "Wednesday", time: "6 PM" }] },
        ],
      },
      {
        name: "Removed site", purok: "", latitude: null, longitude: null,
        googleMapsUrl: "", schedule: [], sourceStatus: "removed",
      },
    ],
  };
  const csv = siteSummaryCsv(barangay);
  assert.equal(csv, "\uFEFFSite name,Purok,Longitiude,Latitude,Googlemaps view,Pick-Up,Drop-off\r\n" +
    '"Collection ""A"", north",Purok 1,120.5,16.4,"https://www.google.com/maps?q=16.4,120.5",Thursday and Friday,Monday: 5 PM; Wednesday: 6 PM\r\n' +
    "Removed site,,,,,,\r\n");
});

test("firing-line CSV keeps each line in separate coordinate and Maps columns", () => {
  const barangay = { firingLines: [
    { name: "Line A", coordinates: [[16.4, 120.5], [16.41, 120.51]] },
    { name: "Line B", coordinates: [[16.42, 120.52]] },
  ] };
  assert.equal(firingLinesCsv(barangay), "\uFEFFFiring line name,Line A,Line A - Google Maps,Line B,Line B - Google Maps\r\n" +
    'Points,"120.5,16.4","https://www.google.com/maps?q=16.4,120.5","120.52,16.42","https://www.google.com/maps?q=16.42,120.52"\r\n' +
    ',"120.51,16.41","https://www.google.com/maps?q=16.41,120.51",,\r\n');
  assert.equal(firingLinesCsv({ firingLines: [] }), null);
});

test("CSV download names identify the selected barangay and local export day", () => {
  assert.deepEqual(barangayCsvFilenames("Dominican Hill-Mirador", new Date(2026, 9, 30)), {
    sites: "dominican_hill_mirador_summary_2026-10-30.csv",
    firingLines: "dominican_hill_mirador_firing_lines_2026-10-30.csv",
  });
});
