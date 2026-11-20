import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
assert.match(html, /<script src="\/app\.js" defer><\/script>/);
const node = () => ({
  append() {}, setAttribute() {}, addEventListener() {}
});
let requestedState = false;
const { meetingDraft, recipientAddresses } = runInNewContext(
  app + "\n({ meetingDraft, recipientAddresses });",
  {
    document: { querySelector: node, createElement: node, documentElement: node(), body: node() },
    matchMedia: node,
    fetch: (resource) => {
      assert.equal(resource, "/api/state");
      requestedState = true;
      return new Promise(() => {});
    }
  }
);
assert.ok(requestedState, "The page script requests tracker records on startup.");

const addresses = recipientAddresses("one@example.com / two@example.com\nONE@example.com");
assert.deepEqual([...addresses], ["one@example.com", "two@example.com"]);
assert.deepEqual([...recipientAddresses("N/A")], []);

const date = "2026-11-20";
const early = { Barangay: "Rock Quarry, Upper", Time: "9:00 AM", "Meeting date": date };
const late = { Barangay: "San Vicente", Time: "", "Meeting date": date };
const rows = [
  { meeting: late, addresses: ["ONE@example.com"] },
  { meeting: early, addresses }
];
const draft = meetingDraft(rows, date, (row) => row.Time ? 540 : 1440);
assert.equal(draft.bcc, "one@example.com, two@example.com");
assert.match(draft.message, /online meeting today/);
assert.match(draft.message, /November 20, 2026/);
assert.match(draft.message, /Rock Quarry, Upper \| 2026-11-20 \| Friday \| 9:00 AM\nSan Vicente \| 2026-11-20 \| Friday \| Time pending/);
assert.match(meetingDraft(rows, "2026-11-19", () => 0).message, /on November 20, 2026/);
