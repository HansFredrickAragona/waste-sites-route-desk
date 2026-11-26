import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const node = () => ({ append() {}, setAttribute() {}, addEventListener() {} });
const targets = runInNewContext(app + "\nmeetingMergeTargets;", {
  document: { querySelector: node, createElement: node, documentElement: node(), body: node(), addEventListener() {} },
  setInterval() {},
  matchMedia: node,
  fetch: () => new Promise(() => {})
});

for (const [status, targetStatus] of [
  ["Scheduled", "Scheduled"], ["Complete", "Complete"], ["Not set", "Not set"], ["Not set", "Scheduled"]
]) {
  const source = { Barangay: "Example", Status: status };
  const same = { Barangay: "Example", Status: targetStatus };
  const other = { ...same, Barangay: "Other" };
  const unrelatedStatus = { ...same, Status: status === "Complete" ? "Scheduled" : "Complete" };
  const rows = [source, same, other, unrelatedStatus].map((row, index) => ({ row, index }));
  assert.deepEqual(Array.from(targets(source, 0, rows), ({ index }) => index), [1]);
}
