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
  barangays: ["All barangays", "Scheduled", "Complete", "Emailed", "Texted", "Replied by text"]
};
let state = { barangays: [], meetings: [] };
let view = "meetings";
const meetingMenu = document.createElement("div");
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

function mergeMeeting(row, index, targets) {
  openEditor("Merge meetings?", ({ target }) => {
    const kept = targets.find((candidate) => String(candidate.index) === target);
    return save("/api/meeting/merge", {
      index, expected: row, keep_index: kept.index, keep_expected: kept.row
    });
  }, "Confirm merge");
  $("#fields").append(element("p", "Remove " + meetingDetails(row)));
  const picker = field("target", "Scheduled meeting to keep", String(targets[0].index),
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

function showMeetingMenu(row, index, targets, x, y) {
  meetingMenu.hidePopover();
  const actions = [["Delete meeting", () => deleteMeeting(row, index)]];
  if (targets.length) actions.push(["Merge meeting", () => mergeMeeting(row, index, targets)]);
  meetingMenu.replaceChildren(...actions.map(([label, action]) => {
    const button = element("button", label);
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

function editOutreach(row) {
  const choices = [["", "Not recorded"], ["Yes", "Yes"], ["No", "No"]];
  openEditor(row["Barangay Name"] || "Roster row " + row["No."],
    (values) => save("/api/outreach", { number: row["No."], ...values }));
  field("email", "Email sent", row["Email sent"], choices);
  field("reply", "Replied by text", row.isreplied, choices);
}

function addRow(cells, edit) {
  const row = document.createElement("tr");
  for (const value of cells) {
    const cell = element("td", "");
    if (value instanceof Node) cell.append(value);
    else cell.textContent = value;
    row.append(cell);
  }
  const button = element("button", "Edit");
  button.onclick = edit;
  row.append(document.createElement("td"));
  row.lastChild.append(button);
  const headers = $("thead").rows[0].cells;
  Array.from(row.cells).forEach((cell, index) => {
    cell.dataset.label = headers[index].textContent;
  });
  $("tbody").append(row);
  return row;
}

function openBarangay(name) {
  $("#search").value = name;
  switchView("barangays");
  const row = Array.from($("tbody").rows).find((item) => item.cells[1].textContent === name);
  if (row) {
    row.classList.add("selected-barangay");
    row.tabIndex = -1;
    row.focus();
  }
}

function outreachBadge(row, field, label, flippedIndex) {
  const value = row[field];
  const key = row["No."] + ":" + field;
  const badge = element("button", value || "Not recorded");
  badge.type = "button";
  badge.className = "badge" + (value === "Yes" ? " complete" : "");
  badge.setAttribute("aria-label", label + ": " + (value || "Not recorded") +
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

function render(flippedIndex) {
  meetingMenu.hidePopover();
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
  const filter = $("#filter").value;
  const query = $("#search").value.trim().toLowerCase();
  const matches = (...values) => values.some((value) => value.toLowerCase().includes(query));
  const meetingView = view === "meetings";
  $("table").classList.toggle("roster-table", !meetingView);
  const headers = meetingView ? ["Barangay", "Meeting date", "Day", "Time", "Status", "Remark"]
    : ["No.", "Barangay", "Email address", "Barangay phone", "Punong Barangay", "Punong Barangay phone",
      "Has meeting", "Emailed", "Texted", "Replied by text"];
  const header = document.createElement("tr");
  header.append(...[...headers, "Action"].map((title) => element("th", title)));
  $("thead").replaceChildren(header);
  $("tbody").replaceChildren();
  $("#add").hidden = !meetingView;

  if (meetingView) {
    const selectedDay = $("#meeting-day").value;
    const selectedDate = $("#meeting-date").value;
    const today = selectedDay === "today" ? manilaDate.format(new Date()) : "";
    const ordered = meetings.map((row, index) => ({ row, index }));
    const sortKey = (row) => {
      const time = row.Time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      const minutes = time ? (Number(time[1]) % 12 + (time[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(time[2]) : 1440;
      return (row["Meeting date"] || "9999") + String(minutes).padStart(4, "0");
    };
    ordered.sort((a, b) => sortKey(a.row).localeCompare(sortKey(b.row)));
    for (const { row, index } of ordered) {
      if (!matches(row.Barangay) || (filter && row.Status !== filter)) continue;
      const date = row["Meeting date"];
      const timestamp = Date.parse(date);
      const day = Number.isFinite(timestamp) ? weekday.format(timestamp) : "—";
      const matchesDay = today ? date === today : !selectedDay || day === selectedDay;
      if (!matchesDay || (selectedDate && date !== selectedDate)) continue;
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
      const targets = row.Status === "Not set"
        ? ordered.filter((target) => target.row.Barangay === row.Barangay && target.row.Status === "Scheduled")
        : [];
      meetingRow.oncontextmenu = (event) => {
        event.preventDefault();
        showMeetingMenu(row, index, targets, event.clientX, event.clientY);
      };
      meetingRow.classList.add("meeting-row");
      meetingRow.tabIndex = 0;
      meetingRow.setAttribute("aria-label", "Open " + row.Barangay + " in Barangay status");
      meetingRow.onclick = (event) => {
        if (!event.target.closest("button")) openBarangay(row.Barangay);
      };
      meetingRow.onkeydown = (event) => {
        if (event.target === meetingRow && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          openBarangay(row.Barangay);
        }
      };
      if (index === flippedIndex) badge.focus({ preventScroll: true });
    }
  } else {
    const meetingNames = new Set(meetings.filter((row) => row.Status === filter).map((row) => row.Barangay));
    for (const row of barangays) {
      const name = row["Barangay Name"];
      if (!matches(name, row["Barangay Email Address"], row["Name of Punong Barangay"])) continue;
      if (filter === "Emailed" && row["Email sent"] !== "Yes") continue;
      if (filter === "Texted" && row.isTextSent !== "Yes") continue;
      if (filter === "Replied by text" && row.isreplied !== "Yes") continue;
      if (["Scheduled", "Complete"].includes(filter) && !meetingNames.has(name)) continue;
      const label = name && !/^\d+$/.test(name) ? name : (name || "Missing name") + " (review source)";
      const flags = [
        outreachBadge(row, "isMeeting", "Has meeting", flippedIndex),
        outreachBadge(row, "Email sent", "Emailed", flippedIndex),
        outreachBadge(row, "isTextSent", "Texted", flippedIndex),
        outreachBadge(row, "isreplied", "Replied by text", flippedIndex)
      ];
      addRow([row["No."], label, row["Barangay Email Address"],
        row["Official Barangay Landline or Barangay CP Number"] || "—",
        row["Name of Punong Barangay"], row["Official Contact Number of Punong Barangay"] || "—",
        ...flags], () => editOutreach(row));
      flags.find((badge) => badge.classList.contains("flipped"))?.focus({ preventScroll: true });
    }
  }
  $("#message").textContent = $("tbody").rows.length ? "" : "No matching records.";
}

function switchView(next) {
  $("#meeting-day").hidden = next !== "meetings";
  $("#meeting-date-filter").hidden = next !== "meetings";
  view = next;
  for (const tab of Object.keys(options)) {
    const button = $("#" + tab);
    button.setAttribute("aria-selected", tab === view);
    button.tabIndex = tab === view ? 0 : -1;
  }
  $("#outreach-panel").setAttribute("aria-labelledby", view);
  fillSelect($("#filter"), options[view].map((label, index) => [index ? label : "", label]));
  render();
}

for (const tab of Object.keys(options)) {
  $("#" + tab).onclick = () => {
    if (tab !== view) switchView(tab);
  };
}
$(".tabs").onkeydown = (event) => {
  let next;
  if (event.key === "Home") next = "meetings";
  if (event.key === "End") next = "barangays";
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    next = view === "meetings" ? "barangays" : "meetings";
  }
  if (!next) return;
  event.preventDefault();
  if (next !== view) switchView(next);
  $("#" + next).focus();
};
$("#search").oninput = render;
$("#filter").onchange = render;
$("#meeting-day").onchange = render;
$("#meeting-date").oninput = render;
$("#add").onclick = () => editMeeting();
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
