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
const { meetingDraft, recipientAddresses, recipientMobiles, meetingTexts, barangayTemplateTexts, selectedRowsCsv, meetingDashboard } = runInNewContext(
  app + "\n({ meetingDraft, recipientAddresses, recipientMobiles, meetingTexts, barangayTemplateTexts, selectedRowsCsv, meetingDashboard });",
  {
    document: { querySelector: node, createElement: node, documentElement: node(), body: node(), addEventListener() {} },
    setInterval() {},
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
const early = { Barangay: "Rock Quarry, Upper", Time: "9:00 AM", "Meeting date": date, Status: "Scheduled" };
const late = { Barangay: "San Vicente", Time: "", "Meeting date": date, Status: "Scheduled" };
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

const complete = { ...early, Status: "Complete" };
const notSet = { Barangay: "Atok Trail", Status: "Not set", "Meeting date": "" };
const later = { ...early, "Meeting date": "2026-11-21" };
for (const meeting of [complete, notSet, later]) {
  const draft = meetingDraft([
    ...rows,
    { meeting, addresses: ["THREE@example.com"] }
  ], date, () => 0);
  assert.match(draft.bcc, /three@example\.com/);
  assert.doesNotMatch(draft.message, /scheduled online meeting|Google Meet/);
}
assert.equal(meetingDraft([{ meeting: notSet, addresses }], date, () => 0).bcc,
  "one@example.com, two@example.com");

const mobiles = [...recipientMobiles("0917 123 4567 / +63 (917) 123-4567; 02 123 4567, 639181234567")];
assert.deepEqual(mobiles, ["+639171234567", "+639181234567"]);
const messages = meetingTexts(new Map([[early, mobiles], [late, [mobiles[0]]], [notSet, [mobiles[1]]]]));
assert.deepEqual([...messages.keys()], mobiles);
assert.match(messages.get(mobiles[0]), /Rock Quarry, Upper.*9:00 AM/);
assert.match(messages.get(mobiles[0]), /San Vicente.*Time pending/);
assert.match(messages.get(mobiles[1]), /Atok Trail/);
assert.doesNotMatch(messages.get(mobiles[1]), /San Vicente/);

const mode = { value: "personalized" };
let submit;
let downloaded;
runInNewContext(app + `
  openEditor = (title, callback) => captureSubmit(callback);
  field = () => mode;
  meetingSelection.set(meeting, mobiles);
  openTextExport();
`, {
  document: {
    querySelector: node, documentElement: node(), body: node(), addEventListener() {},
    createElement: (tag) => tag === "a" ? { click() {} } : node()
  },
  matchMedia: node,
  setInterval() {},
  fetch: () => new Promise(() => {}),
  mode, meeting: early, mobiles,
  captureSubmit: (callback) => { submit = callback; },
  Blob: class {
    constructor([contents]) { downloaded = JSON.parse(contents); }
  },
  URL: { createObjectURL: () => "blob:test" },
  setTimeout() {}
});
mode.value = "common";
mode.onchange();
submit({ messageMode: "common", commonMessage: "Shared reminder" });
assert.deepEqual(downloaded, { messages: mobiles.map((mobile) => ({ mobile, message: "Shared reminder" })) });
assert.throws(() => submit({ messageMode: "common", commonMessage: " " }), /Enter a common message/);
mode.value = "personalized";
mode.onchange();
submit({ messageMode: "personalized", [mobiles[0]]: "First", [mobiles[1]]: "Second" });
assert.deepEqual(downloaded.messages.map(({ message }) => message), ["First", "Second"]);

// Roster selections must use general outreach wording, even with meeting-like fields.
const rosterMeeting = { Barangay: "Sample Barangay", Status: "Scheduled", "Meeting date": date, Time: "9:00 AM" };
const general = meetingTexts(new Map([[rosterMeeting, mobiles]]), true);
assert.match(general.get(mobiles[0]), /Sample Barangay/);
assert.doesNotMatch(general.get(mobiles[0]), /meeting|November|9:00 AM/i);

let rosterSubmit;
let rosterDownload;
const rosterCreated = [];
const draftFields = new Map();
const rosterNode = (selector) => {
  if (!draftFields.has(selector)) draftFields.set(selector, { ...node(), showModal() {} });
  return draftFields.get(selector);
};
runInNewContext(app + `
  view = "barangays";
  const roster = { "Barangay Name": "Sample Barangay", "Email sent": "No" };
  meetingSelection.set(roster, ["+639171234567"]);
  openEditor = (title, callback) => captureSubmit(callback);
  field = () => mode;
  openTextExport();
  if (roster["Email sent"] !== "No") throw new Error("Drafting changed outreach flags");
  meetingSelection.set(roster, ["ONE@example.com", "one@example.com"]);
  document.querySelector("#email-confirm").onclick();
`, {
  document: {
    querySelector: rosterNode, documentElement: node(), body: node(), addEventListener() {},
    createElement: (tag) => {
      const created = tag === "a" ? { click() {} } : node();
      rosterCreated.push(created);
      return created;
    }
  },
  matchMedia: node,
  setInterval() {},
  fetch: () => new Promise(() => {}),
  mode: { value: "personalized" },
  captureSubmit: (callback) => { rosterSubmit = callback; },
  Blob: class { constructor([contents]) { rosterDownload = JSON.parse(contents); } },
  URL: { createObjectURL: () => "blob:test" }, setTimeout() {}
});
rosterSubmit({ messageMode: "common", commonMessage: "Barangay outreach" });
assert.deepEqual(rosterDownload, { messages: [{ mobile: "+639171234567", message: "Barangay outreach" }] });
assert.equal(draftFields.get("#draft-bcc").value, "one@example.com");
assert.equal(draftFields.get("#email-draft-title").textContent, "Barangay email draft");
assert.doesNotMatch(draftFields.get("#draft-message").value, /scheduled|Google Meet/);

const templateInput = rosterCreated.find((item) => item.name === "messageTemplate");
const applyTemplate = rosterCreated.find((item) => item.textContent === "Apply template to all");
const personalInput = rosterCreated.find((item) => item.name === "+639171234567");
assert.match(personalInput.value, /online meeting.*Sample Barangay/);
personalInput.value = "Individual edit";
templateInput.value = "Hello <Barangay>, when are you available?";
assert.equal(personalInput.value, "Individual edit", "Typing a template does not discard individual edits.");
applyTemplate.onclick();
assert.equal(personalInput.value, "Hello Sample Barangay, when are you available?");
templateInput.value = " ";
applyTemplate.onclick();
assert.equal(draftFields.get("#error").textContent, "Enter a message template.");
assert.equal(personalInput.value, "Hello Sample Barangay, when are you available?");
rosterSubmit({ messageMode: "personalized", [personalInput.name]: personalInput.value });
assert.equal(rosterDownload.messages[0].message, personalInput.value);

const templated = barangayTemplateTexts(new Map([
  [{ Barangay: "Alpha" }, [mobiles[0]]],
  [{ Barangay: "Beta" }, mobiles],
  [{ Barangay: "Alpha" }, [mobiles[0]]]
]), "Hello <Barangay>!\nAvailability for <Barangay>?");
assert.equal(templated.size, 2);
assert.equal(templated.get(mobiles[0]), "Hello Alpha, Beta!\nAvailability for Alpha, Beta?");
assert.equal(templated.get(mobiles[1]), "Hello Beta!\nAvailability for Beta?");
assert.throws(() => barangayTemplateTexts(new Map(), "  "), /Enter a message template/);

assert.equal(selectedRowsCsv("barangays", [{
  "Barangay Name": 'Alpha, "Upper"', "Barangay Email Address": "",
  "Official Barangay Landline or Barangay CP Number": "0741234567",
  "Name of Punong Barangay": "Juan", "Official Contact Number of Punong Barangay": "09171234567",
  "Email sent": "Yes"
}]), '\ufeff"Barangay","Email address","Barangay phone","Punong Barangay","Punong Barangay phone"\r\n"Alpha, ""Upper""","","0741234567","Juan","09171234567"\r\n');
const meetingCsv = selectedRowsCsv("meetings", [{ ...early, Remark: "First\nSecond" }]);
assert.match(meetingCsv, /"Barangay","Meeting date","Day","Time","Status","Remark"/);
assert.match(meetingCsv, /"Friday","9:00 AM","Scheduled","First\nSecond"/);
assert.doesNotMatch(meetingCsv, /Action|Edit/);
assert.throws(() => selectedRowsCsv("dashboard", []), /Choose Meetings or Barangay status/);
assert.match(selectedRowsCsv("meetings", [{ Barangay: "Pending", "Meeting date": "" }]), /"Pending","","","","",""/);
assert.doesNotMatch(html, /id="text-selection"/);
assert.match(html, /id="export-as"/);

const dashboard = meetingDashboard([
  { Barangay: "Atok Trail", Status: "Complete", "Meeting date": date },
  { Barangay: "Atok Trail", Status: "Complete", "Meeting date": "2026-11-21" },
  { Barangay: "Atok Trail", Status: "Scheduled", "Meeting date": "2026-11-22" },
  { Barangay: "Other", Status: "Not set", "Meeting date": "" }
], ["Atok Trail", "Other", "No meeting"].map((name) => ({ "Barangay Name": name })));
assert.equal(dashboard.meetingCounts.Complete, 2);
assert.equal(dashboard.meetingCounts.Scheduled, 1);
assert.equal(dashboard.barangayCounts.Complete, 1);
assert.equal(dashboard.barangayCounts.Scheduled, 0);
assert.equal(dashboard.barangayCounts["Not set"], 1);
assert.equal(dashboard.barangayCounts["No meeting"], 1);
assert.equal([...dashboard.dailyMeetings.values()].flat().length, 3);
assert.equal(Object.values(dashboard.barangayCounts).reduce((sum, count) => sum + count, 0), 3);
assert.equal(meetingDashboard([], []).barangayCounts["No meeting"], 0);

const noAction = meetingDashboard([
  { Barangay: "Meeting only", Status: "Not set", "Meeting date": "" },
  { Barangay: "Completed", Status: "Complete", "Meeting date": date }
], [
  { "Barangay Name": "Meeting only" },
  { "Barangay Name": "Completed" },
  { "Barangay Name": "Email only", "Email sent": "Yes" },
  { "Barangay Name": "Text only", isTextSent: "Yes" },
  { "Barangay Name": "Reply only", isreplied: "Yes" },
  { "Barangay Name": "Manual meeting", isMeeting: "Yes" },
  { "Barangay Name": "Untouched" },
  { "Barangay Name": "Explicit No", "Email sent": "No", isMeeting: "No" }
]);
assert.equal(noAction.barangayCounts.Complete, 1);
assert.equal(noAction.noMovementCount, 6, "Outreach flags do not count as meeting movement; Not set meeting rows do.");

const syncFields = new Map();
const syncDocument = {
  hidden: false, documentElement: node(), body: node(), createElement: node, addEventListener() {},
  querySelector(selector) {
    if (!syncFields.has(selector)) syncFields.set(selector, node());
    return syncFields.get(selector);
  }
};
await runInNewContext(app + `
  (async () => {
    view = "dashboard";
    let renders = 0;
    renderDashboard = () => { renders++; };
    const fresh = { barangays: [], meetings: [] };
    fetch = async () => ({ ok: true, json: async () => fresh });
    await refreshDashboard();
    assert.equal(state, fresh);
    assert.equal(renders, 1);
    assert.match(document.querySelector("#dashboard-sync").textContent, /Last checked/);
    fetch = async () => { throw new Error("Offline"); };
    await refreshDashboard();
    assert.equal(state, fresh);
    assert.match(document.querySelector("#dashboard-sync").textContent, /Refresh failed/);
    fetch = async () => {
      view = "meetings";
      return { ok: true, json: async () => ({ meetings: ["stale"], barangays: [] }) };
    };
    await refreshDashboard();
    assert.equal(state, fresh);
    assert.equal(renders, 1);
    view = "dashboard";
    const newer = { meetings: ["newer save"], barangays: [] };
    fetch = async () => {
      state = newer;
      return { ok: true, json: async () => fresh };
    };
    await refreshDashboard();
    assert.equal(state, newer);
    document.hidden = true;
    fetch = () => { throw new Error("Hidden dashboard should not poll"); };
    await refreshDashboard();
    assert.equal(state, newer);
  })();
`, {
  document: syncDocument, matchMedia: node, setInterval() {}, assert,
  fetch: () => new Promise(() => {})
});
