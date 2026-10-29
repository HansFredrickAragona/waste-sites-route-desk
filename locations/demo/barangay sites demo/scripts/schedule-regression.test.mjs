import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  addScheduleDay,
  normalizeSiteSchedule,
  removeScheduleDay,
  scheduleDayEntries,
  scheduleWithoutDates,
  sourceScheduleRows,
  updateScheduleEntry,
} from "../src/features/barangay-review/utils/pinFormHelpers.js";
import {
  buildInitialReview,
  normalizeReviewData,
} from "../src/features/json-library/services/reviewRepository.js";
import { createMapEditingActions } from "../src/features/barangay-review/actions/createMapEditingActions.js";

const records = JSON.parse(await readFile(new URL("../../../data/jsons/barangays/barangay_sites_v2.json", import.meta.url), "utf8"));
const irisan = records.find((record) => record.barangay.name === "Irisan" && record.site_name === "Site 1");

test("Irisan Site 1 keeps Thursday and Friday in one pickup list", () => {
  assert.ok(irisan, "The reported source record must exist");
  const original = structuredClone(irisan.schedule);
  const schedule = normalizeSiteSchedule(irisan.schedule);
  assert.deepEqual(schedule["pick-up"].map((row) => row.day), ["Thursday", "Friday"]);
  assert.deepEqual(schedule["drop-off"], []);
  assert.equal(scheduleDayEntries(irisan.schedule, "drop-off").length, 1);
  assert.deepEqual(scheduleWithoutDates(irisan.schedule), [{
    "pick-up": [{ day: "Thursday" }, { day: "Friday" }],
  }]);
  assert.deepEqual(irisan.schedule, original, "Reading the schedule must not mutate the source");
});

test("old cached Schedule 2 placeholders disappear without losing filled days", () => {
  const blank = { day: "", startTime: "", startPeriod: "", endTime: "", endPeriod: "" };
  const oldDraft = [
    { "pick-up": [{ ...blank, day: "Thursday" }, { ...blank, day: "Friday" }], "drop-off": [{ ...blank }] },
    { "pick-up": [{ ...blank }], "drop-off": [{ ...blank }] },
  ];
  const schedule = normalizeSiteSchedule(oldDraft);
  assert.deepEqual(schedule["pick-up"].map((row) => row.day), ["Thursday", "Friday"]);
  assert.equal(scheduleDayEntries(oldDraft, "drop-off").length, 1);
  assert.equal(scheduleWithoutDates(oldDraft).length, 1);
  assert.deepEqual(sourceScheduleRows(oldDraft), [{ label: "pick up", value: "Thursday; Friday" }]);
});

test("merging mixed legacy groups preserves independent day and time entries", () => {
  const legacy = [
    { "pick-up": { day: "Mon", time: "8:00 AM - 9:00 AM" } },
    { "drop-off": { day: "TUES", time: "6:00 PM - 7:00 PM" } },
    { "pick-up": [{ day: "Wednesday", time: "10:30 AM - 11:30 AM" }, { day: "Monday", time: "2:00 PM - 3:00 PM" }] },
    { "drop-off": [{ day: "Friday" }, { day: "Saturday" }] },
  ];
  const original = structuredClone(legacy);
  const saved = scheduleWithoutDates(legacy);
  assert.deepEqual(saved, [{
    "pick-up": [
      { day: "Monday", time: "8:00 AM - 9:00 AM" },
      { day: "Wednesday", time: "10:30 AM - 11:30 AM" },
      { day: "Monday", time: "2:00 PM - 3:00 PM" },
    ],
    "drop-off": [
      { day: "Tuesday", time: "6:00 PM - 7:00 PM" },
      { day: "Friday" },
      { day: "Saturday" },
    ],
  }]);
  assert.deepEqual(scheduleWithoutDates(JSON.parse(JSON.stringify(saved))), saved);
  assert.deepEqual(legacy, original);
});

test("Add day and typed times update only the chosen section", () => {
  let draft = addScheduleDay(irisan.schedule, "pick-up");
  assert.equal(draft.length, 1);
  assert.equal(scheduleDayEntries(draft, "pick-up").length, 3, "New blank row must remain editable");
  draft = updateScheduleEntry(draft, "pick-up", 2, { day: "Saturday", startTime: "8:", startPeriod: "AM" });
  assert.equal(scheduleDayEntries(draft, "pick-up")[2].startTime, "8:", "Typing must not reformat incomplete input");
  draft = updateScheduleEntry(draft, "drop-off", 0, { day: "Sunday" });
  draft = addScheduleDay(draft, "drop-off");
  draft = updateScheduleEntry(draft, "pick-up", 2, { startTime: "8:15", endTime: "10:30", endPeriod: "AM" });
  assert.equal(scheduleDayEntries(draft, "drop-off").length, 2, "Editing pickup must retain the added drop-off row");
  assert.deepEqual(scheduleWithoutDates(draft), [{
    "pick-up": [{ day: "Thursday" }, { day: "Friday" }, { day: "Saturday", time: "8:15 AM - 10:30 AM" }],
    "drop-off": { day: "Sunday" },
  }]);
  draft = removeScheduleDay(draft, "pick-up", 1);
  assert.deepEqual(scheduleDayEntries(draft, "pick-up").map((row) => row.day), ["Thursday", "Saturday"]);
  assert.deepEqual(scheduleDayEntries(draft, "drop-off").map((row) => row.day), ["Sunday", ""]);
});

test("new sites start with one row per section and allow optional times", () => {
  assert.equal(scheduleDayEntries([], "pick-up").length, 1);
  assert.equal(scheduleDayEntries([], "drop-off").length, 1);
  let draft = updateScheduleEntry([], "drop-off", 0, { day: "Monday" });
  draft = addScheduleDay(draft, "drop-off");
  draft = updateScheduleEntry(draft, "drop-off", 1, { day: "Wednesday" });
  assert.deepEqual(scheduleWithoutDates(draft), [{ "drop-off": [{ day: "Monday" }, { day: "Wednesday" }] }]);
  assert.deepEqual(scheduleWithoutDates(addScheduleDay([], "pick-up")), []);
});

test(`all ${records.length} source sites survive save/export/reimport with at most one schedule pair`, () => {
  const review = buildInitialReview(records);
  const expected = new Map();
  for (const barangay of review.barangays) {
    for (const pin of barangay.pins) {
      expected.set(pin.id, sourceScheduleRows(pin.schedule));
      pin.schedule = scheduleWithoutDates(pin.schedule);
      assert.ok(pin.schedule.length <= 1, `${barangay.name} / ${pin.name} has extra schedule groups`);
    }
  }
  const restored = normalizeReviewData(JSON.parse(JSON.stringify(review)));
  let siteCount = 0;
  for (const barangay of restored.barangays) {
    for (const pin of barangay.pins) {
      const rows = sourceScheduleRows(pin.schedule);
      assert.deepEqual(rows, expected.get(pin.id), `${barangay.name} / ${pin.name} lost schedule information`);
      assert.equal(new Set(rows.map((row) => row.label)).size, rows.length);
      siteCount += 1;
    }
  }
  assert.equal(siteCount, records.length);
});

test("firing-line days and confirmation survive save and JSON reimport", () => {
  const review = buildInitialReview(records);
  const barangay = review.barangays.find((item) => item.name === "Irisan");
  let savedBarangay;
  let schedule = updateScheduleEntry([], "pick-up", 0, { day: "Thursday" });
  schedule = addScheduleDay(schedule, "pick-up");
  schedule = updateScheduleEntry(schedule, "pick-up", 1, { day: "Friday", startTime: "8:00", startPeriod: "AM" });
  schedule = updateScheduleEntry(schedule, "drop-off", 0, { day: "Saturday" });
  const actions = createMapEditingActions({
    selectedBarangay: barangay,
    lineDraft: {
      id: "test-firing-line",
      isNew: true,
      name: "  Test firing line  ",
      coordinates: [[16.416, 120.556], [16.417, 120.557]],
      schedule,
      review: { is_brgy_confirmed: true },
      notes: "  Checked with barangay  ",
    },
    clearDraftUndoHistory() {},
    commitBarangay(_id, transform) { savedBarangay = transform(barangay); },
    setSelectedLineId() {},
    setLineDraft() {},
    setSelectedLineNodeIndex() {},
    setShowLineNodeStreetView() {},
    setMode() {},
    setPinManagerCollapsed() {},
  });
  actions.saveLine({ preventDefault() {} });
  const restored = normalizeReviewData(JSON.parse(JSON.stringify({
    ...review,
    barangays: review.barangays.map((item) => item.id === barangay.id ? savedBarangay : item),
  })));
  const line = restored.barangays.find((item) => item.id === barangay.id).firingLines[0];
  assert.equal(line.name, "Test firing line");
  assert.deepEqual(line.schedule, [{
    "pick-up": [{ day: "Thursday" }, { day: "Friday", time: "8:00 AM" }],
    "drop-off": { day: "Saturday" },
  }]);
  assert.equal(line.review.is_brgy_confirmed, true);
  assert.equal(line.notes, "Checked with barangay");
  assert.deepEqual(line.coordinates, [[16.416, 120.556], [16.417, 120.557]]);

  const restoredBarangay = restored.barangays.find((item) => item.id === barangay.id);
  let editedBarangay;
  const editActions = createMapEditingActions({
    selectedBarangay: restoredBarangay,
    lineDraft: {
      ...line,
      isNew: false,
      schedule: updateScheduleEntry(line.schedule, "drop-off", 0, { day: "Sunday" }),
      review: { is_brgy_confirmed: false },
    },
    clearDraftUndoHistory() {},
    commitBarangay(_id, transform) { editedBarangay = transform(restoredBarangay); },
    setSelectedLineId() {},
    setLineDraft() {},
    setSelectedLineNodeIndex() {},
    setShowLineNodeStreetView() {},
    setMode() {},
    setPinManagerCollapsed() {},
  });
  editActions.saveLine({ preventDefault() {} });
  assert.equal(editedBarangay.firingLines.length, 1, "Editing must update the existing line");
  const edited = normalizeReviewData(JSON.parse(JSON.stringify({
    ...restored,
    barangays: restored.barangays.map((item) => item.id === barangay.id ? editedBarangay : item),
  }))).barangays.find((item) => item.id === barangay.id).firingLines[0];
  assert.deepEqual(edited.schedule[0]["drop-off"], { day: "Sunday" });
  assert.equal(edited.review.is_brgy_confirmed, false);
  assert.deepEqual(edited.schedule[0]["pick-up"], line.schedule[0]["pick-up"]);
});
