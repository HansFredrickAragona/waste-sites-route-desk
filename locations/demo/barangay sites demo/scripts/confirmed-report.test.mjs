import assert from "node:assert/strict";
import test from "node:test";
import { confirmedGeoJson, confirmedReport } from "../src/features/dashboard/confirmedReport.js";
import { createLineDraft, createMapEditingActions, createPinDraft } from "../src/features/barangay-review/actions/createMapEditingActions.js";

test("GeoJSON includes mapped collection points and named connected lines from confirmed barangays", () => {
  const point = { name: "Collection point", purok: "Purok 2", latitude: 16.4, longitude: 120.6 };
  const barangay = {
    id: "confirmed", name: "Irisan", confirmed: true, puroks: [],
    pins: [point, { ...point, sourceStatus: "removed" }, { ...point, latitude: null }],
    firingLines: [{ name: "Route", coordinates: [[16.4, 120.6], [16.41, 120.6]] }],
  };
  const report = confirmedReport([barangay, { ...barangay, id: "open", confirmed: false }], []);
  assert.deepEqual(confirmedGeoJson(report), {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { barangay: "Irisan", name: "Collection point", site_name: "Collection point", purok: "Purok 2" },
      geometry: { type: "Point", coordinates: [120.6, 16.4] },
    }, {
      type: "Feature",
      properties: { barangay: "Irisan", name: "Route", type: "firing_line", puroks: [] },
      geometry: { type: "LineString", coordinates: [[120.6, 16.4], [120.6, 16.41]] },
    }],
  });
});

test("GeoJSON groups sites alphabetically by barangay without changing report order", () => {
  const point = { latitude: 16.4, longitude: 120.6 };
  const report = [
    { barangay: { name: "Zeta", pins: [{ ...point, name: "Z site" }] } },
    { barangay: { name: "Alpha", pins: [{ ...point, name: "A site" }, { ...point, name: "Second site" }] } },
  ];
  const before = JSON.stringify(report);
  assert.deepEqual(confirmedGeoJson(report).features.map(({ properties }) => properties), [
    { barangay: "Alpha", name: "A site", site_name: "A site", purok: "" },
    { barangay: "Alpha", name: "Second site", site_name: "Second site", purok: "" },
    { barangay: "Zeta", name: "Z site", site_name: "Z site", purok: "" },
  ]);
  assert.equal(JSON.stringify(report), before);
});

test("confirmed report sorts by latest update and reconciles counts with details", () => {
  const schedule = [{ "drop-off": [{ day: "Monday" }] }];
  const barangays = [
    { id: "old", name: "Old", confirmed: true, pins: [], firingLines: [], puroks: [] },
    { id: "new", name: "New", confirmed: true, puroks: ["One", "One"], pins: [
      { id: "point", name: "Point", schedule }, { id: "removed", name: "Removed", sourceStatus: "removed" },
    ], firingLines: [{ id: "line", name: "Line", schedule, puroks: ["One"] }] },
    { id: "open", name: "Open", confirmed: false, pins: [], firingLines: [], puroks: [] },
  ];
  const report = confirmedReport(barangays, [{ barangayId: "new", timestamp: "2026-11-10T00:00:00Z" }]);
  assert.deepEqual(report.map(({ barangay }) => barangay.id), ["new", "old"]);
  assert.deepEqual(report[0].summary.slice(0, 6), ["New", "Monday", "", 1, 1, 1]);
  assert.equal(report[0].details.length, 2);
  assert.deepEqual(report[0].detailTargets.map(({ kind, item }) => [kind, item.id]), [
    ["pin", "point"], ["line", "line"],
  ]);
  assert.equal(report[1].summary.at(-1), "");
});

test("report editors save to the row's barangay independently of the selected map barangay", () => {
  const point = { id: "point", name: "Point", latitude: 16.4, longitude: 120.6 };
  const line = { id: "line", name: "Line", coordinates: [[16.4, 120.6], [16.41, 120.6]], notes: "" };
  let barangay = { id: "report", name: "Report barangay", confirmed: true, pins: [point], firingLines: [line], puroks: [] };
  const { commitPinDraft, commitLineDraft } = createMapEditingActions({
    selectedBarangay: { id: "map" },
    commitBarangay(id, update) {
      assert.equal(id, barangay.id);
      barangay = update(barangay);
    },
  });
  const failOnError = ({ text }) => assert.fail(text);

  commitPinDraft(barangay, { ...createPinDraft(point), name: "Updated point" }, failOnError);
  commitLineDraft(barangay, { ...createLineDraft(line), name: "Updated line" }, failOnError);

  assert.deepEqual(confirmedReport([barangay], [])[0].details.map(([name]) => name), ["Updated point", "Updated line"]);
  assert.deepEqual(barangay.firingLines[0].coordinates, line.coordinates);
});
