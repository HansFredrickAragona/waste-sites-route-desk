const $ = (selector) => document.querySelector(selector);
const cursorGlow = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

document.documentElement.addEventListener("pointermove", (event) => {
  if (!cursorGlow.matches || event.pointerType !== "mouse") return;
  document.body.style.setProperty("--cursor-x", event.clientX + "px");
  document.body.style.setProperty("--cursor-y", event.clientY + "px");
});
document.documentElement.addEventListener("pointerleave", () => {
  document.body.style.removeProperty("--cursor-x");
  document.body.style.removeProperty("--cursor-y");
});
const form = $("#form");
const editor = $("#editor");
const weekday = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" });
const manilaDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Manila", dateStyle: "short" });
const options = {
  meetings: ["All meetings", "Scheduled", "Complete", "Not set"],
  barangays: ["All barangays", "Scheduled", "Complete", "Has meeting", "Has movement: Yes", "Has movement: No",
    "Emailed", "Texted", "Replied by text"]
};
const tabs = ["meetings", "barangays", "dashboard"];
const sidebarTabs = matchMedia("(min-width: 801px)");
function updateTabOrientation() {
  $(".tabs").setAttribute("aria-orientation", sidebarTabs.matches ? "vertical" : "horizontal");
}
sidebarTabs.addEventListener("change", updateTabOrientation);
updateTabOrientation();
let state = { barangays: [], meetings: [] };
let view = "meetings";
let selectionMode = "";
const meetingSelection = new Map();
const meetingMenu = document.createElement("div");
const compactMeetings = matchMedia("(max-width: 800px)");
meetingMenu.id = "meeting-menu";
meetingMenu.setAttribute("popover", "auto");
meetingMenu.setAttribute("aria-label", "Meeting actions");
document.body.append(meetingMenu);

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function fillSelect(select, choices) {
  select.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
}

function field(name, label, value, choices, type = "text") {
  const wrapper = element("label", label);
  const input = document.createElement(choices ? "select" : "input");
  input.name = name;
  if (choices) fillSelect(input, choices);
  else input.type = type;
  if (type === "file") input.accept = ".csv,text/csv";
  else input.value = value;
  wrapper.append(input);
  $("#fields").append(wrapper);
  return input;
}

function openEditor(title, submit, submitLabel = "Save changes") {
  $("#editor-title").textContent = title;
  $("#fields").replaceChildren();
  $("#error").textContent = "";
  const button = form.querySelector('[type="submit"]');
  button.textContent = submitLabel;
  form.onsubmit = async (event) => {
    event.preventDefault();
    button.disabled = true;
    $("#cancel").disabled = true;
    try {
      await submit(Object.fromEntries(new FormData(form)));
      editor.close();
      render();
    } catch (error) {
      $("#error").textContent = error.message;
    } finally {
      button.disabled = false;
      $("#cancel").disabled = false;
    }
  };
  editor.showModal();
}

async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return saveResponse(response);
}

async function save(path, body) {
  state = await post(path, body);
  meetingSelection.clear();
}

async function saveResponse(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Restart the tracker server and refresh this page, then try again.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not save.");
  return data;
}

function editMeeting(row = {}, index) {
  openEditor(index === undefined ? "Add meeting" : "Edit meeting",
    (meeting) => save("/api/meeting", { index, meeting }));
  const names = state.barangays.map((item) => item["Barangay Name"])
    .filter((name) => name && !/^\d+$/.test(name));
  field("Barangay", "Barangay", row.Barangay || "",
    [["", "Select a barangay"], ...names.map((name) => [name, name])]);
  field("Meeting date", "Meeting date", row["Meeting date"] || "", null, "date");
  field("Time", "Time (optional, e.g. 3:00 PM)", row.Time || "");
  field("Status", "Status", row.Status || "Scheduled",
    options.meetings.slice(1).map((status) => [status, status]));
  field("Remark", "Remark (optional)", row.Remark ?? "");
}

function meetingDetails(row) {
  return [row.Barangay, row["Meeting date"] || "Date pending", row.Time || "Time pending", row.Status].join(" · ");
}

function deleteMeeting(row, index) {
  openEditor("Delete meeting?", () => save("/api/meeting/delete", { index, expected: row }), "Confirm delete");
  $("#fields").append(element("p", meetingDetails(row)));
}

function meetingMergeTargets(row, index, meetings) {
  return meetings.filter((target) => target.index !== index
    && target.row.Barangay === row.Barangay
    && (target.row.Status === row.Status || (row.Status === "Not set" && target.row.Status === "Scheduled")));
}

function mergeMeeting(row, index, targets) {
  openEditor("Merge meetings?", ({ target }) => {
    const kept = targets.find((candidate) => String(candidate.index) === target);
    return save("/api/meeting/merge", {
      index, expected: row, keep_index: kept.index, keep_expected: kept.row
    });
  }, "Confirm merge");
  $("#fields").append(element("p", "Remove " + meetingDetails(row)));
  const picker = field("target", "Meeting to keep", String(targets[0].index),
    targets.map((target) => [String(target.index), meetingDetails(target.row)]));
  const preview = element("p", "");
  preview.style.whiteSpace = "pre-wrap";
  picker.onchange = () => {
    const kept = targets.find((target) => String(target.index) === picker.value).row;
    const remarks = [kept.Remark, row.Remark].filter(Boolean).join("\n");
    preview.textContent = remarks ? "Merged remark\n" + remarks : "No remarks to merge.";
  };
  picker.onchange();
  $("#fields").append(preview);
}

function showMeetingMenu(row, index, targets, x, y, statusButton) {
  const actions = [["Delete meeting", () => deleteMeeting(row, index)]];
  if (targets.length) actions.push(["Merge meeting", () => mergeMeeting(row, index, targets)]);
  if (compactMeetings.matches) {
    actions.unshift(["Edit meeting", () => editMeeting(row, index)],
      ["Open Barangay status", () => openBarangay(row.Barangay)]);
    if (statusButton) actions.splice(1, 0, [statusButton.title, () => statusButton.click()]);
  }
  showContextMenu("Meeting actions", actions, x, y);
}

function showContextMenu(label, actions, x, y) {
  meetingMenu.hidePopover();
  meetingMenu.setAttribute("aria-label", label);
  meetingMenu.replaceChildren(...actions.map(([title, action]) => {
    const button = element("button", title);
    button.type = "button";
    button.onclick = () => {
      meetingMenu.hidePopover();
      action();
    };
    return button;
  }));
  meetingMenu.showPopover();
  meetingMenu.style.left = Math.max(0, Math.min(x, innerWidth - meetingMenu.offsetWidth - 8)) + "px";
  meetingMenu.style.top = Math.max(0, Math.min(y, innerHeight - meetingMenu.offsetHeight - 8)) + "px";
  meetingMenu.firstElementChild.focus({ preventScroll: true });
}

function enableContactEdit(cell, row, key, label) {
  cell.classList.add("editable-contact");
  const openMenu = (x, y) => showContextMenu(label + " actions", [["Edit", () => {
    const expected = row[key];
    openEditor(`Edit ${label} · ${row["Barangay Name"]}`, ({ value }) =>
      save("/api/contact", { number: row["No."], field: key, expected, value }));
    const input = field("value", label, expected);
    input.focus();
    input.select();
  }]], x, y);
  cell.tabIndex = 0;
  cell.title = "Right-click to edit " + label;
  cell.oncontextmenu = (event) => {
    event.preventDefault();
    openMenu(event.clientX, event.clientY);
  };
  cell.onkeydown = (event) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    const bounds = cell.getBoundingClientRect();
    openMenu(bounds.left, bounds.bottom);
  };
}

function addRow(cells, edit) {
  const row = document.createElement("tr");
  for (const value of cells) {
    const cell = element("td", "");
    if (value instanceof Node) cell.append(value);
    else cell.textContent = value;
    row.append(cell);
  }
  const headers = $("thead").rows[0].cells;
  if (cells.length < headers.length) row.append(document.createElement("td"));
  if (edit) {
    const button = element("button", "Edit");
    button.onclick = edit;
    row.lastChild.append(button);
  }
  Array.from(row.cells).forEach((cell, index) => {
    cell.dataset.label = headers[index].textContent;
  });
  $("tbody").append(row);
  return row;
}

function openBarangay(name) {
  $("#search").value = name;
  switchView("barangays");
  const row = Array.from($("tbody").rows).find((item) => item.querySelector(".roster-desktop-name")?.textContent === name);
  if (row) {
    row.classList.add("selected-barangay");
    row.tabIndex = -1;
    row.focus();
  }
}

function outreachBadge(row, field, label, flippedIndex) {
  const value = row[field] || "No";
  const key = row["No."] + ":" + field;
  const badge = element("button", value);
  badge.type = "button";
  badge.className = "badge" + (value === "Yes" ? " complete" : "");
  badge.setAttribute("aria-label", label + ": " + value +
    ". Set to " + (value === "Yes" ? "No" : "Yes"));
  if (key === flippedIndex) badge.classList.add("flipped");
  badge.onclick = async () => {
    badge.disabled = true;
    try {
      await save("/api/outreach-toggle", { number: row["No."], field });
      render(key);
    } catch (error) {
      $("#message").textContent = error.message;
      badge.disabled = false;
    }
  };
  return badge;
}

function meetingMinutes(row) {
  const time = (row.Time || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!time) return 1440;
  const hours = Number(time[1]) % 12 + (time[3].toUpperCase() === "PM" ? 12 : 0);
  return hours * 60 + Number(time[2]);
}

const dateLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });

function recipientAddresses(value) {
  const addresses = value?.match(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
  return [...new Set(addresses.map((address) => address.toLowerCase()))];
}

function meetingDraft(rows, today, meetingMinutes) {
  const ordered = [...rows].sort((a, b) => meetingMinutes(a.meeting) - meetingMinutes(b.meeting));
  const date = ordered[0].meeting["Meeting date"];
  const timestamp = Date.parse(date);
  const bcc = [...new Set(ordered.flatMap(({ addresses }) =>
    addresses.map((address) => address.toLowerCase())))].join(", ");
  if (!Number.isFinite(timestamp) || !ordered.every(({ meeting }) =>
    meeting.Status === "Scheduled" && meeting["Meeting date"] === date)) {
    return { bcc, message: "Good morning po!\n\n\n\nMaraming salamat po!\n\nHans Aragona\nCity Mayor’s Office" };
  }
  const formattedDate = dateLabel.format(timestamp);
  const day = dayLabel.format(timestamp);
  const when = date === today ? "today" : "on " + formattedDate;
  const schedule = ordered.map(({ meeting }) =>
    [meeting.Barangay, date, day, meeting.Time || "Time pending"].join(" | ")).join("\n");
  const message = `Good morning po!

I would like to confirm whether you are available for your scheduled online meeting ${when}. If you are unavailable, please let me know when you are available.

Via Google Meet po ang ating meeting tungkol sa site collection sa ${formattedDate}.

Join the meeting on Google Meet: https://meet.google.com/air-rukd-nkw

For your reference, here’s the meeting advisory: https://drive.google.com/file/d/1NRSkWMvUub-ugthszr2gXZI9903xFIa1/view?usp=sharing

Here is the schedule for the selected barangays:

Barangay | Meeting date | Day | Time
${schedule}

Maraming salamat po!

Hans Aragona
City Mayor’s Office`;
  return { bcc, message };
}

function recipientMobiles(value) {
  const numbers = (value || "").split(/[,/;\r\n]+/).flatMap((raw) => {
    const match = raw.replace(/[\s()-]/g, "").match(/^(?:\+?63|0)?(9[0-9]{9})$/);
    return match ? ["+63" + match[1]] : [];
  });
  return [...new Set(numbers)];
}

function meetingTexts(selection) {
  const byMobile = new Map();
  for (const [meeting, mobiles] of selection) {
    const date = Date.parse(meeting["Meeting date"]);
    const detail = [meeting.Barangay, Number.isFinite(date) && dateLabel.format(date),
      meeting.Status === "Scheduled" ? meeting.Time || "Time pending" : meeting.Status].filter(Boolean);
    for (const mobile of mobiles) {
      if (!byMobile.has(mobile)) byMobile.set(mobile, new Set());
      byMobile.get(mobile).add(detail.join(" – "));
    }
  }
  return new Map([...byMobile].map(([mobile, details]) => [mobile,
    ["Good day po! This is Hans from the Baguio City Mayor’s Office regarding our WasteConnect meeting.",
      ...details, "Please let us know if you have any questions or need to coordinate a schedule. Maraming salamat po!"].join("\n\n")]));
}

function openTextExport() {
  const messages = meetingTexts(meetingSelection);
  openEditor("Review meeting texts", (values) => {
    const common = values.messageMode === "common";
    const batch = [...messages.keys()].map((mobile) => ({
      mobile,
      message: common ? values.commonMessage : values[mobile]
    }));
    if (batch.some(({ message }) => !message.trim())) {
      throw new Error(common ? "Enter a common message." : "Enter a message for every mobile number.");
    }
    const file = new Blob([JSON.stringify({ messages: batch }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting-texts-${manilaDate.format(new Date())}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "Download JSON");
  const mode = field("messageMode", "Message type", "personalized", [
    ["personalized", "Personalized messages"],
    ["common", "One common message for all"]
  ]);
  function addMessage(name, title, message) {
    const label = element("label", title);
    const input = document.createElement("textarea");
    input.name = name;
    input.rows = 5;
    input.required = true;
    input.value = message;
    label.append(input);
    $("#fields").append(label);
    return { label, input };
  }
  const common = addMessage("commonMessage", "Message for all selected mobile numbers", "");
  const personalized = [...messages].map(([mobile, message]) => addMessage(mobile, mobile, message));
  function updateMessageMode() {
    const useCommon = mode.value === "common";
    common.input.disabled = common.label.hidden = !useCommon;
    for (const { label, input } of personalized) {
      input.disabled = label.hidden = useCommon;
    }
    $("#error").textContent = "";
  }
  mode.onchange = updateMessageMode;
  updateMessageMode();
}

function setMeetingSelection(mode) {
  selectionMode = mode;
  meetingSelection.clear();
  $("#email-selection").setAttribute("aria-pressed", String(mode === "email"));
  $("#text-selection").setAttribute("aria-pressed", String(mode === "text"));
  $("#email-actions").hidden = !mode;
}

function updateMeetingSelection() {
  $("#email-selection-status").textContent = `${meetingSelection.size} selected`;
  $("#email-confirm").disabled = !meetingSelection.size;
}

function addSelectionMeetingRow(meeting, day, recipients) {
  const date = meeting["Meeting date"];
  const name = element("span", meeting.Barangay);
  const choice = element("label", "");
  choice.className = "meeting-email-choice";
  if (recipients?.length) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = meetingSelection.has(meeting);
    checkbox.onchange = () => {
      if (checkbox.checked) meetingSelection.set(meeting, recipients);
      else meetingSelection.delete(meeting);
      updateMeetingSelection();
    };
    choice.append(checkbox, name);
  } else {
    choice.append(name, element("small", selectionMode === "text" ? "No valid mobile on file" : "No email on file"));
  }
  const row = addRow([choice, date, day, meeting.Time || "Pending", meeting.Status, meeting.Remark ?? ""]);
  row.classList.add("meeting-row");
}

function renderOutreachChart() {
  const selected = new Set([...document.querySelectorAll("#outreach-chart-filter input:checked")]
    .map((input) => input.value));
  const series = [
    ["Email sent", "Emailed", "Not emailed", "#315d43"],
    ["isTextSent", "Texted", "Not texted", "#7956a0"],
    ["isreplied", "Replied by text", "No text reply", "#92702f"],
    ["isMeeting", "Has meeting", "No meeting", "#356b86"]
  ].filter(([key]) => selected.has(key));
  const rings = [];
  const legend = [];
  const total = state.barangays.length;
  for (const [index, [key, yesLabel, noLabel, color]] of series.entries()) {
    const yes = state.barangays.filter((row) => row[key] === "Yes").length;
    const no = total - yes;
    const yesEnd = total ? yes / total * 100 : 0;
    const ring = element("span", "");
    ring.style.setProperty("--ring-inset", index * 16 + "%");
    ring.style.background = `conic-gradient(${color} 0% ${yesEnd}%, #a69d87 ${yesEnd}% 100%)`;
    rings.push(ring);
    const item = element("li", "");
    const heading = element("strong", `${yesLabel}: ${yes} · ${noLabel}: ${no}`);
    heading.style.color = color;
    item.append(heading);
    legend.push(item);
  }
  $("#outreach-rings").hidden = !rings.length;
  $("#outreach-rings").replaceChildren(...rings);
  $("#outreach-chart-legend").replaceChildren(...(legend.length ? legend : [element("li", "Select an outreach status to show its breakdown.")]));
}

$("#outreach-chart-filter").onchange = renderOutreachChart;

function renderDashboard() {
  renderOutreachChart();
  const dayCard = $("#day-card");
  dayCard.hidePopover();
  const { meetings, barangays } = state;
  const summary = [
    ["Scheduled", meetings.filter((row) => row.Status === "Scheduled").length],
    ["Complete", meetings.filter((row) => row.Status === "Complete").length],
    ["Emailed", barangays.filter((row) => row["Email sent"] === "Yes").length],
    ["Texted", barangays.filter((row) => row.isTextSent === "Yes").length],
    ["Replied by text", barangays.filter((row) => row.isreplied === "Yes").length]
  ];
  $("#summary").replaceChildren(...summary.map(([label, count]) => {
    const card = element("div", "");
    card.className = "metric";
    card.append(element("strong", count), label);
    return card;
  }));
  const rosterNames = new Set(barangays.map((row) => row["Barangay Name"].trim()));
  const barangayStatuses = new Map();
  const priority = { "Not set": 1, Scheduled: 2, Complete: 3 };
  const dailyMeetings = new Map();
  for (const meeting of meetings) {
    const status = meeting.Status;
    const name = meeting.Barangay.trim();
    if (name && rosterNames.has(name) && priority[status] > (priority[barangayStatuses.get(name)] ?? 0)) {
      barangayStatuses.set(name, status);
    }
    const date = meeting["Meeting date"];
    if (date && (status === "Scheduled" || status === "Complete")) {
      if (!dailyMeetings.has(date)) dailyMeetings.set(date, []);
      dailyMeetings.get(date).push(meeting);
    }
  }
  const categories = [
    ["Complete", "#315d43"], ["Scheduled", "#7956a0"],
    ["Not set", "#858d58"], ["No meeting", "#d7c7a8"]
  ];
  const statuses = [...barangayStatuses.values()];
  let end = 0;
  const slices = [];
  $("#status-legend").replaceChildren(...categories.map(([label, color]) => {
    const count = label === "No meeting"
      ? barangays.length - barangayStatuses.size
      : statuses.filter((status) => status === label).length;
    if (count) {
      const start = end;
      end += count;
      slices.push(`${color} ${start / barangays.length * 100}% ${end / barangays.length * 100}%`);
    }
    const item = element("li", `${label}: ${count}`);
    item.style.setProperty("--swatch", color);
    return item;
  }));
  $("#status-pie").style.background = slices.length ? `conic-gradient(${slices.join(", ")})` : "#eee8da";
  const days = [...dailyMeetings].sort(([a], [b]) => a.localeCompare(b));
  const maxCount = Math.max(1, ...days.map(([, entries]) => entries.length));
  $("#daily-meetings").replaceChildren(...(days.length ? days.map(([date, entries]) => {
    const count = entries.length;
    const item = element("li", "");
    const bar = element("span", "");
    bar.className = "daily-bar";
    bar.setAttribute("aria-hidden", "true");
    bar.style.width = `${count / maxCount * 100}%`;
    const complete = entries.filter((meeting) => meeting.Status === "Complete").length;
    const completedSegment = element("span", "");
    completedSegment.className = "daily-bar-complete";
    completedSegment.style.width = `${complete / count * 100}%`;
    bar.append(completedSegment);
    const toggle = element("button", "");
    toggle.type = "button";
    toggle.className = "daily-toggle";
    toggle.setAttribute("aria-label", `${date}: ${complete} complete, ${count - complete} scheduled`);
    toggle.setAttribute("popovertarget", "day-card");
    const day = element("time", date);
    day.dateTime = date;
    toggle.append(day, bar, element("strong", count));
    const breakdown = element("ul", "");
    breakdown.className = "daily-breakdown";
    entries.sort((a, b) => meetingMinutes(a) - meetingMinutes(b));
    for (const meeting of entries) {
      const entry = element("li", "");
      const status = element("span", meeting.Status);
      status.className = "badge " + meeting.Status.toLowerCase();
      const timing = element("span", (meeting.Time || "Time pending") + " · ");
      timing.append(status);
      entry.append(element("strong", meeting.Barangay), timing);
      if (meeting.Remark) entry.append(element("small", meeting.Remark));
      breakdown.append(entry);
    }
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      const wasOpen = dayCard.matches(":popover-open");
      if (wasOpen) {
        dayCard.hidePopover();
        if (dayCard.dataset.date === date) return;
      }
      dayCard.dataset.date = date;
      dayCard.replaceChildren(element("h3", date), breakdown);
      dayCard.showPopover({ source: toggle });
      const bounds = toggle.getBoundingClientRect();
      dayCard.style.left = Math.max(8, Math.min(bounds.left, innerWidth - dayCard.offsetWidth - 8)) + "px";
      const above = bounds.top - dayCard.offsetHeight - 8;
      dayCard.style.top = Math.max(8, above >= 8 ? above : Math.min(bounds.bottom + 8, innerHeight - dayCard.offsetHeight - 8)) + "px";
    });
    item.append(toggle);
    return item;
  }) : [element("li", "No dated meetings yet.")]));
}

function render(flippedIndex) {
  meetingMenu.hidePopover();
  if (view === "dashboard") {
    renderDashboard();
    return;
  }
  const { meetings, barangays } = state;
  const filter = $("#filter").value;
  const query = $("#search").value.trim().toLowerCase();
  const matches = (...values) => values.some((value) => value.toLowerCase().includes(query));
  const meetingView = view === "meetings";
  $("#email-selection").hidden = !meetingView;
  $("#text-selection").hidden = !meetingView;
  $("table").classList.toggle("roster-table", !meetingView);
  $("table").classList.toggle("meeting-email-mode", Boolean(selectionMode));
  const headers = meetingView ? ["Barangay", "Meeting date", "Day", "Time", "Status", "Remark"]
    : ["No.", "Barangay", "Email address", "Barangay phone", "Punong Barangay", "Punong Barangay phone",
      "Has meeting", "Has movement", "Emailed", "Texted", "Replied by text"];
  const header = document.createElement("tr");
  if (meetingView) headers.push(selectionMode ? "" : "Action");
  header.append(...headers.map((title) => element("th", title)));
  $("thead").replaceChildren(header);
  $("tbody").replaceChildren();
  $("#add").hidden = !meetingView || Boolean(selectionMode);

  if (meetingView) {
    const recipientsByBarangay = new Map();
    if (selectionMode) {
      for (const contact of barangays) {
        const name = contact["Barangay Name"];
        const recipients = selectionMode === "text"
          ? recipientMobiles(contact["Official Contact Number of Punong Barangay"])
          : recipientAddresses(contact["Barangay Email Address"]);
        recipientsByBarangay.set(name, [...(recipientsByBarangay.get(name) ?? []), ...recipients]);
      }
    }
    const selectedDay = $("#meeting-day").value;
    const selectedDate = $("#meeting-date").value;
    const currentDate = manilaDate.format(new Date());
    const today = selectedDay === "today" ? currentDate : "";
    const ordered = meetings.map((row, index) => ({ row, index }));
    const rank = (row) => {
      if (row.Status === "Scheduled") return row["Meeting date"] >= currentDate ? 0 : 1;
      if (row.Status === "Complete") return 4;
      return row["Meeting date"] ? 2 : 3;
    };
    ordered.sort(({ row: a }, { row: b }) => {
      const group = rank(a);
      const groupOrder = group - rank(b);
      if (groupOrder) return groupOrder;
      const dateOrder = (a["Meeting date"] || "").localeCompare(b["Meeting date"] || "");
      const timeOrder = meetingMinutes(a) - meetingMinutes(b);
      return group === 0 ? dateOrder || timeOrder : -(dateOrder || timeOrder);
    });
    for (const { row, index } of ordered) {
      if (!matches(row.Barangay) || (filter && row.Status !== filter)) continue;
      const date = row["Meeting date"];
      const timestamp = Date.parse(date);
      const day = Number.isFinite(timestamp) ? weekday.format(timestamp) : "—";
      const matchesDay = today ? date === today : !selectedDay || day === selectedDay;
      if (!matchesDay || (selectedDate && date !== selectedDate)) continue;
      if (selectionMode) {
        addSelectionMeetingRow(row, day, recipientsByBarangay.get(row.Barangay));
        continue;
      }
      const canFlip = row.Status === "Scheduled" || row.Status === "Complete";
      const badge = element(canFlip ? "button" : "span", row.Status);
      badge.className = "badge " + row.Status.toLowerCase();
      if (canFlip) {
        const nextStatus = row.Status === "Scheduled" ? "Complete" : "Scheduled";
        badge.type = "button";
        badge.title = "Mark " + nextStatus.toLowerCase();
        badge.setAttribute("aria-label", row.Barangay + ": " + row.Status + ". " + badge.title);
        badge.onclick = async () => {
          badge.disabled = true;
          try {
            await save("/api/meeting", { index, meeting: { ...row, Status: nextStatus } });
            render(index);
          } catch (error) {
            $("#message").textContent = error.message;
            badge.disabled = false;
          }
        };
        if (index === flippedIndex) badge.classList.add("flipped");
      }
      const meetingRow = addRow([row.Barangay, date || "Pending", day, row.Time || "Pending", badge, row.Remark ?? ""],
        () => editMeeting(row, index));
      const targets = meetingMergeTargets(row, index, ordered);
      meetingRow.oncontextmenu = (event) => {
        event.preventDefault();
        showMeetingMenu(row, index, targets, event.clientX, event.clientY, canFlip ? badge : null);
      };
      meetingRow.classList.add("meeting-row");
      if (canFlip) {
        const mobileBadge = element("span", row.Status);
        mobileBadge.className = badge.className + " mobile-meeting-status";
        badge.parentElement.append(mobileBadge);
      }
      meetingRow.tabIndex = 0;
      meetingRow.setAttribute("aria-label", row.Barangay + " meeting");
      const activateRow = () => {
        if (compactMeetings.matches) {
          const bounds = meetingRow.getBoundingClientRect();
          showMeetingMenu(row, index, targets, bounds.left + 8, bounds.bottom, canFlip ? badge : null);
        } else {
          openBarangay(row.Barangay);
        }
      };
      meetingRow.onclick = (event) => {
        if (!event.target.closest("button")) activateRow();
      };
      meetingRow.onkeydown = (event) => {
        if (event.target === meetingRow && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          activateRow();
        }
      };
      if (index === flippedIndex) badge.focus({ preventScroll: true });
    }
  } else {
    const movementNames = new Set(meetings.map((row) => row.Barangay));
    const meetingNames = new Set(meetings.filter((row) => row.Status === filter).map((row) => row.Barangay));
    for (const row of barangays) {
      const name = row["Barangay Name"];
      const hasMovement = movementNames.has(name);
      if (!matches(name, row["Barangay Email Address"], row["Name of Punong Barangay"])) continue;
      if (filter === "Emailed" && row["Email sent"] !== "Yes") continue;
      if (filter === "Texted" && row.isTextSent !== "Yes") continue;
      if (filter === "Replied by text" && row.isreplied !== "Yes") continue;
      if (filter === "Has meeting" && row.isMeeting !== "Yes") continue;
      if (filter === "Has movement: Yes" && !hasMovement) continue;
      if (filter === "Has movement: No" && hasMovement) continue;
      if (["Scheduled", "Complete"].includes(filter) && !meetingNames.has(name)) continue;
      const label = name && !/^\d+$/.test(name) ? name : (name || "Missing name") + " (review source)";
      const flags = [
        outreachBadge(row, "isMeeting", "Has meeting", flippedIndex),
        outreachBadge(row, "Email sent", "Emailed", flippedIndex),
        outreachBadge(row, "isTextSent", "Texted", flippedIndex),
        outreachBadge(row, "isreplied", "Replied by text", flippedIndex)
      ];
      const rosterRow = addRow([row["No."], label, row["Barangay Email Address"],
        row["Official Barangay Landline or Barangay CP Number"] || "—",
        row["Name of Punong Barangay"], row["Official Contact Number of Punong Barangay"] || "—",
        flags[0], hasMovement ? "Yes" : "No", ...flags.slice(1)]);
      const contactKeys = ["Barangay Email Address", "Official Barangay Landline or Barangay CP Number",
        "Name of Punong Barangay", "Official Contact Number of Punong Barangay"];
      contactKeys.forEach((key, index) => {
        const cell = rosterRow.cells[index + 2];
        enableContactEdit(cell, row, key, cell.dataset.label);
      });
      const disclosure = element("button", label);
      disclosure.type = "button";
      disclosure.className = "roster-disclosure";
      disclosure.setAttribute("aria-expanded", "false");
      const desktopName = element("span", label);
      desktopName.className = "roster-desktop-name";
      rosterRow.cells[1].replaceChildren(desktopName, disclosure);
      disclosure.onclick = () => {
        disclosure.setAttribute("aria-expanded", rosterRow.classList.toggle("roster-expanded"));
      };
      rosterRow.onclick = (event) => {
        if (compactMeetings.matches && !event.target.closest("button, a")) disclosure.click();
      };
      flags.find((badge) => badge.classList.contains("flipped"))?.focus({ preventScroll: true });
    }
  }
  if (selectionMode) {
    $("#email-select-all").disabled = !document.querySelector(".meeting-email-choice input");
    updateMeetingSelection();
  }
  $("#message").textContent = $("tbody").rows.length ? "" : "No matching records.";
}

function switchView(next) {
  setMeetingSelection("");
  $("#day-card").hidePopover();
  $("#meeting-day").hidden = next !== "meetings";
  $("#meeting-date-filter").hidden = next !== "meetings";
  view = next;
  for (const tab of tabs) {
    const button = $("#" + tab);
    button.setAttribute("aria-selected", tab === view);
    button.tabIndex = tab === view ? 0 : -1;
  }
  const dashboard = view === "dashboard";
  $("#dashboard-panel").hidden = !dashboard;
  $("#outreach-panel").hidden = dashboard;
  $(".toolbar").hidden = dashboard;
  if (!dashboard) {
    $("#outreach-panel").setAttribute("aria-labelledby", view);
    fillSelect($("#filter"), options[view].map((label, index) => [index ? label : "", label]));
  }
  render();
}

for (const tab of tabs) {
  $("#" + tab).onclick = () => {
    if (tab !== view) switchView(tab);
  };
}
$(".tabs").onkeydown = (event) => {
  let next;
  if (event.key === "Home") next = "meetings";
  if (event.key === "End") next = "dashboard";
  const previousKey = sidebarTabs.matches ? "ArrowUp" : "ArrowLeft";
  const nextKey = sidebarTabs.matches ? "ArrowDown" : "ArrowRight";
  if (event.key === previousKey || event.key === nextKey) {
    const offset = event.key === previousKey ? -1 : 1;
    next = tabs[(tabs.indexOf(view) + offset + tabs.length) % tabs.length];
  }
  if (!next) return;
  event.preventDefault();
  if (next !== view) switchView(next);
  $("#" + next).focus();
};
function applyFilters() {
  meetingSelection.clear();
  render();
}
$("#search").oninput = applyFilters;
$("#filter").onchange = applyFilters;
$("#meeting-day").onchange = applyFilters;
$("#meeting-date").oninput = applyFilters;
$("#add").onclick = () => editMeeting();
for (const mode of ["email", "text"]) {
  $(`#${mode}-selection`).onclick = () => {
    setMeetingSelection(selectionMode === mode ? "" : mode);
    render();
  };
}
$("#email-select-all").onclick = () => {
  for (const checkbox of document.querySelectorAll(".meeting-email-choice input:not(:checked)")) {
    checkbox.click();
  }
};
$("#email-cancel").onclick = () => {
  const button = $(`#${selectionMode}-selection`);
  setMeetingSelection("");
  render();
  button.focus();
};
$("#email-confirm").onclick = () => {
  if (!meetingSelection.size) return;
  if (selectionMode === "text") {
    openTextExport();
    return;
  }
  const rows = [...meetingSelection].map(([meeting, addresses]) => ({ meeting, addresses }));
  const draft = meetingDraft(rows, manilaDate.format(new Date()), meetingMinutes);
  $("#draft-bcc").value = draft.bcc;
  $("#draft-message").value = draft.message;
  $("#draft-status").textContent = "";
  $("#email-draft").showModal();
};
for (const [button, field, label] of [
  ["#copy-bcc", "#draft-bcc", "BCC addresses"],
  ["#copy-message", "#draft-message", "Message"]
]) {
  $(button).onclick = async () => {
    try {
      await navigator.clipboard.writeText($(field).value);
      $("#draft-status").textContent = label + " copied.";
    } catch {
      $(field).select();
      $("#draft-status").textContent = "Clipboard unavailable. Copy the selected text manually.";
    }
  };
}
$("#cancel").onclick = () => editor.close();
$("#import").onclick = () => {
  openEditor("Import tracker CSV", async (values) => {
    const selected = Object.entries(values).filter(([, file]) => file.name);
    if (!selected.length) throw new Error("Choose at least one CSV.");
    if (selected.some(([, file]) => file.size > 500_000)) throw new Error("Each CSV must be under 500 KB.");
    const files = await Promise.all(selected.map(async ([key, file]) => [key, await file.text()]));
    state = await post("/api/import", Object.fromEntries(files));
    $("#snapshot-message").textContent = "Import complete. Previous version saved to " + state.backup;
    switchView(view);
  }, "Confirm import");
  $("#fields").append(element("p", "Choose one or both CSVs from a current tracker export. Each selected file replaces its corresponding table. A backup is saved first."));
  field("contacts", "Barangay status CSV", "", null, "file");
  field("meetings", "Meetings CSV", "", null, "file");
};
$("#snapshot").onclick = () => {
  openEditor("Confirm CSV export", async (values) => {
    const filenames = Object.fromEntries(Object.entries(values).map(([key, value]) => {
      const name = value.trim();
      if (!name) throw new Error("Enter a name for each CSV.");
      return [key, /\.csv$/i.test(name) ? name : name + ".csv"];
    }));
    const response = await fetch("/api/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filenames)
    });
    const data = await saveResponse(response);
    $("#snapshot-message").textContent = "Saved both CSVs to " + data.folder;
  }, "Confirm save");
  $("#fields").append(element("p", "Both files will be saved in a new version folder under output."));
  field("contacts_name", "Barangay status filename", "barangay-status.csv");
  field("meetings_name", "Meetings filename", "meetings.csv");
  form.elements.contacts_name.focus();
};
editor.addEventListener("cancel", (event) => {
  if ($("#cancel").disabled) event.preventDefault();
});
fetch("/api/state").then((response) => {
  if (!response.ok) throw new Error("Could not load the local CSV files.");
  return response.json();
}).then((data) => {
  state = data;
  switchView("meetings");
}).catch((error) => { $("#message").textContent = error.message; });
