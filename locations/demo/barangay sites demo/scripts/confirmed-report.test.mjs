import assert from "node:assert/strict";
import test from "node:test";
import { confirmedReport } from "../src/features/dashboard/confirmedReport.js";

test("confirmed report sorts by latest update and reconciles counts with details", () => {
  const schedule = [{ "drop-off": [{ day: "Monday" }] }];
  const barangays = [
    { id: "old", name: "Old", confirmed: true, pins: [], firingLines: [], puroks: [] },
    { id: "new", name: "New", confirmed: true, puroks: ["One", "One"], pins: [
      { name: "Point", schedule }, { name: "Removed", sourceStatus: "removed" },
    ], firingLines: [{ name: "Line", schedule, puroks: ["One"] }] },
    { id: "open", name: "Open", confirmed: false, pins: [], firingLines: [], puroks: [] },
  ];
  const report = confirmedReport(barangays, [{ barangayId: "new", timestamp: "2026-11-10T00:00:00Z" }]);
  assert.deepEqual(report.map(({ barangay }) => barangay.id), ["new", "old"]);
  assert.deepEqual(report[0].summary.slice(0, 6), ["New", "Monday", "", 1, 1, 1]);
  assert.equal(report[0].details.length, 2);
  assert.equal(report[1].summary.at(-1), "");
});
