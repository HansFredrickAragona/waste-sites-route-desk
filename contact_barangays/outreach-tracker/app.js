const $ = (selector) => document.querySelector(selector);
const form = $("#form");
const editor = $("#editor");
const weekday = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" });
const options = {
  meetings: ["All meetings", "Scheduled", "Complete", "Not set"],
  barangays: ["All barangays", "Scheduled", "Complete", "Emailed", "Texted", "Replied by text"]
};
let state = { barangays: [], meetings: [] };
let view = "meetings";

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
  input.value = value;
  wrapper.append(input);
  $("#fields").append(wrapper);
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

async function save(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  state = await saveResponse(response);
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
  $("tbody").append(row);
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
  const headers = meetingView ? ["Barangay", "Meeting date", "Day", "Time", "Status", "Remark"]
    : ["No.", "Barangay", "Email address", "Punong Barangay", "Has meeting", "Emailed", "Texted", "Replied by text"];
  const header = document.createElement("tr");
  header.append(...[...headers, "Action"].map((title) => element("th", title)));
  $("thead").replaceChildren(header);
  $("tbody").replaceChildren();
  $("#add").hidden = !meetingView;

  if (meetingView) {
    const ordered = meetings.map((row, index) => ({ row, index }));
    const sortKey = (row) => {
      const time = row.Time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      const minutes = time ? (Number(time[1]) % 12 + (time[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(time[2]) : 1440;
      return (row["Meeting date"] || "9999") + String(minutes).padStart(4, "0");
    };
    ordered.sort((a, b) => sortKey(a.row).localeCompare(sortKey(b.row)));
    for (const { row, index } of ordered) {
      if (!matches(row.Barangay) || (filter && row.Status !== filter)) continue;
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
      const date = row["Meeting date"];
      const timestamp = Date.parse(date);
      const day = Number.isFinite(timestamp) ? weekday.format(timestamp) : "—";
      addRow([row.Barangay, date || "Pending", day, row.Time || "Pending", badge, row.Remark ?? ""],
        () => editMeeting(row, index));
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
      addRow([row["No."], label, row["Barangay Email Address"], row["Name of Punong Barangay"],
        ...flags], () => editOutreach(row));
      flags.find((badge) => badge.classList.contains("flipped"))?.focus({ preventScroll: true });
    }
  }
  $("#message").textContent = $("tbody").rows.length ? "" : "No matching records.";
}

function switchView(next) {
  view = next;
  for (const tab of Object.keys(options)) $("#" + tab).setAttribute("aria-pressed", tab === view);
  fillSelect($("#filter"), options[view].map((label, index) => [index ? label : "", label]));
  render();
}

$("#meetings").onclick = () => switchView("meetings");
$("#barangays").onclick = () => switchView("barangays");
$("#search").oninput = render;
$("#filter").onchange = render;
$("#add").onclick = () => editMeeting();
$("#cancel").onclick = () => editor.close();
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
