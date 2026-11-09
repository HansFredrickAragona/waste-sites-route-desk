import argparse
import csv
from datetime import date, datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from io import StringIO
import json
from pathlib import Path
import re
import socket
from tempfile import TemporaryDirectory

HERE = Path(__file__).resolve().parent
CONTACTS = ("No.", "Barangay Name", "Barangay Email Address", "Name of Punong Barangay",
            "isMeeting", "isreplied", "Email sent", "Meeting override", "isTextSent",
            "Official Barangay Landline or Barangay CP Number", "Official Contact Number of Punong Barangay")
MEETINGS = ("Barangay", "Meeting date", "Time", "Status", "Remark")


def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def import_rows(content, fields, label):
    reader = csv.DictReader(StringIO(content.removeprefix("\ufeff"), newline=""), strict=True)
    columns = reader.fieldnames or []
    if len(columns) != len(fields) or set(columns) != set(fields):
        raise ValueError(f"{label} must have the columns from a current tracker export.")
    rows = list(reader)
    if any(None in row or None in row.values() for row in rows):
        raise ValueError(f"{label} contains a row with the wrong number of columns.")
    return rows


def read_meetings(path):
    rows = read_csv(path)
    for row in rows:
        if "Remark" not in row:
            follow_up = (row["Barangay"], row["Meeting date"], row["Time"]) == (
                "Atok Trail", "2026-11-06", "3:00 PM")
            row["Remark"] = "Follow-up" if follow_up else ""
    return rows


def write_csv(path, fields, rows):
    temporary = path.with_suffix(".tmp")
    with temporary.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fields)
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


class Tracker:
    def __init__(self, folder):
        self.contacts = folder / "barangay-status.csv"
        self.meetings = folder / "meetings.csv"
        folder.mkdir(parents=True, exist_ok=True)

    def seed(self, roster, checklist=None):
        history = read_csv(checklist) if checklist and (not self.contacts.exists() or not self.meetings.exists()) else []
        if not self.contacts.exists():
            emailed = {row["Barangay"] for row in history if row["Email sent"] == "Yes"}
            rows = [{**{field: row[field] for field in (*CONTACTS[:4], *CONTACTS[-2:])},
                     "isMeeting": "No", "isreplied": "",
                     "Email sent": "Yes" if row["Barangay Name"] in emailed else ""}
                    for row in read_csv(roster)]
            write_csv(self.contacts, CONTACTS, rows)
        if not self.meetings.exists():
            rows = [{"Barangay": row["Barangay"], "Meeting date": row["Meeting date"],
                     "Time": row["Meeting time"], "Status": row["Status"]}
                    for row in history if row["Status"] in ("Scheduled", "Complete")]
            write_csv(self.meetings, MEETINGS, rows)
        self.state()

    def state(self):
        barangays = read_csv(self.contacts)
        meetings = read_meetings(self.meetings)
        linked = {row["Barangay"] for row in meetings if row["Status"] != "Not set"}
        changed = False
        for row in barangays:
            row.setdefault("isTextSent", "")
            flag = row.get("Meeting override") or ("Yes" if row["Barangay Name"] in linked else "No")
            if row["isMeeting"] != flag:
                row["isMeeting"] = flag
                changed = True
        if changed:
            write_csv(self.contacts, CONTACTS, barangays)
        return {"barangays": barangays, "meetings": meetings}

    def outreach(self, number, email, reply):
        if email not in ("", "Yes", "No") or reply not in ("", "Yes", "No"):
            raise ValueError("Choose a valid outreach status.")
        rows = read_csv(self.contacts)
        row = next((row for row in rows if row["No."] == number), None)
        if row is None:
            raise ValueError("Barangay number not found.")
        row.update({"Email sent": email, "isreplied": reply})
        write_csv(self.contacts, CONTACTS, rows)

    def toggle_outreach(self, number, field):
        if field not in ("isMeeting", "Email sent", "isreplied", "isTextSent"):
            raise ValueError("Choose a valid outreach flag.")
        rows = self.state()["barangays"]
        row = next((row for row in rows if row["No."] == number), None)
        if row is None:
            raise ValueError("Barangay number not found.")
        target = "Meeting override" if field == "isMeeting" else field
        row[target] = "No" if row[field] == "Yes" else "Yes"
        write_csv(self.contacts, CONTACTS, rows)

    def snapshot(self, output, contacts_name="barangay-status.csv", meetings_name="meetings.csv"):
        names = (contacts_name, meetings_name)
        for name in names:
            if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _-]{0,79}\.csv", name, re.IGNORECASE):
                raise ValueError("Use letters, numbers, spaces, hyphens, or underscores, ending in .csv.")
            if re.fullmatch(r"CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9]", Path(name).stem.strip(), re.IGNORECASE):
                raise ValueError("Choose a filename that Windows allows.")
        if contacts_name.casefold() == meetings_name.casefold():
            raise ValueError("Give the two CSV files different names.")
        state = self.state()
        manila = timezone(timedelta(hours=8))
        stamp = datetime.now(manila).strftime("%Y-%m-%d_%H-%M-%S_%f_PHT")
        output.mkdir(parents=True, exist_ok=True)
        with TemporaryDirectory(dir=output) as staging:
            folder = Path(staging)
            write_csv(folder / contacts_name, CONTACTS, state["barangays"])
            write_csv(folder / meetings_name, MEETINGS, state["meetings"])
            folder.rename(output / stamp)
        return stamp

    def import_version(self, output, contacts=None, meetings=None):
        if contacts is None and meetings is None:
            raise ValueError("Select at least one CSV to import.")
        current = self.state()
        roster = current["barangays"] if contacts is None else import_rows(contacts, CONTACTS, "Barangay status")
        schedule = current["meetings"] if meetings is None else import_rows(meetings, MEETINGS, "Meetings")
        numbers = {row["No."] for row in roster}
        if not roster or "" in numbers or len(numbers) != len(roster):
            raise ValueError("Barangay status must contain unique, nonblank roster numbers.")
        for row in roster:
            for field in ("isMeeting", "isreplied", "Email sent", "Meeting override", "isTextSent"):
                value = row[field].strip().capitalize()
                if value not in ("", "Yes", "No"):
                    raise ValueError(f"Invalid {field} value on roster row {row['No.']}.")
                row[field] = value
        names = {row["Barangay Name"] for row in roster}
        for row in schedule:
            self.validate_meeting(row, names)
        backup = self.snapshot(output)
        with TemporaryDirectory(dir=self.contacts.parent) as staging:
            folder = Path(staging)
            new_contacts = folder / self.contacts.name
            new_meetings = folder / self.meetings.name
            old_contacts = folder / "previous.csv"
            if contacts is not None:
                old_contacts.write_bytes(self.contacts.read_bytes())
                write_csv(new_contacts, CONTACTS, roster)
            if meetings is not None:
                write_csv(new_meetings, MEETINGS, schedule)
            if contacts is not None:
                new_contacts.replace(self.contacts)
            try:
                if meetings is not None:
                    new_meetings.replace(self.meetings)
            except OSError:
                if contacts is not None:
                    old_contacts.replace(self.contacts)
                raise
        return {**self.state(), "backup": "output/" + backup}

    @staticmethod
    def validate_meeting(row, names):
        if row["Barangay"] not in names or not row["Barangay"] or row["Barangay"].isdigit():
            raise ValueError("Select a barangay from the roster.")
        if row["Status"] not in ("Scheduled", "Complete", "Not set"):
            raise ValueError("Choose a valid meeting status.")
        if row["Meeting date"]:
            date.fromisoformat(row["Meeting date"])
        elif row["Status"] != "Not set":
            raise ValueError("Enter the meeting date.")

    def meeting(self, values, index=None):
        row = {field: values[field].strip() for field in MEETINGS if field != "Remark"}
        row["Remark"] = values.get("Remark", "").strip()
        names = {item["Barangay Name"] for item in read_csv(self.contacts)}
        self.validate_meeting(row, names)
        rows = read_meetings(self.meetings)
        if index is None:
            if row not in rows:
                rows.append(row)
        elif type(index) is int and 0 <= index < len(rows):
            if "Remark" not in values:
                row["Remark"] = rows[index]["Remark"]
            rows[index] = row
        else:
            raise ValueError("Meeting not found.")
        write_csv(self.meetings, MEETINGS, rows)


def handler(tracker, address):
    assets = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"),
              "/style.css": ("style.css", "text/css")}

    class Handler(BaseHTTPRequestHandler):
        def respond(self, body, content_type, status=200):
            self.send_response(status)
            self.send_header("Content-Type", content_type + "; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def respond_json(self, data, status=200):
            self.respond(json.dumps(data).encode(), "application/json", status)

        def do_GET(self):
            if self.headers.get("Host") not in address:
                self.send_error(403)
            elif self.path == "/api/state":
                self.respond_json(tracker.state())
            elif self.path in assets:
                filename, content_type = assets[self.path]
                self.respond((HERE / filename).read_bytes(), content_type)
            else:
                self.send_error(404)

        def do_POST(self):
            if self.headers.get("Host") not in address or self.headers.get("Origin") != "http://" + self.headers["Host"]:
                self.send_error(403)
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                limit = 2_000_000 if self.path == "/api/import" else 8192
                if not 0 < length <= limit:
                    raise ValueError("Invalid request size.")
                data = json.loads(self.rfile.read(length))
                if self.path == "/api/outreach":
                    tracker.outreach(data["number"], data["email"], data["reply"])
                elif self.path == "/api/outreach-toggle":
                    tracker.toggle_outreach(data["number"], data["field"])
                elif self.path == "/api/snapshot":
                    version = tracker.snapshot(HERE / "output", **data)
                    self.respond_json({"folder": "output/" + version})
                    return
                elif self.path == "/api/import":
                    self.respond_json(tracker.import_version(HERE / "output", **data))
                    return
                elif self.path == "/api/meeting":
                    tracker.meeting(data["meeting"], data.get("index"))
                else:
                    self.send_error(404)
                    return
                self.respond_json(tracker.state())
            except (ValueError, TypeError, KeyError, AttributeError, csv.Error) as error:
                self.respond_json({"error": str(error)}, 400)
            except OSError:
                self.respond_json({"error": "Could not save the CSV. Close it in Excel and retry."}, 500)

    return Handler


class LocalServer(HTTPServer):
    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.allow_reuse_address = False
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the local Barangay Outreach Tracker.")
    parser.add_argument("--checklist", type=Path, help="Existing outreach checklist used on first launch")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    roster = HERE.parents[1] / "locations/data/csvs/raw/Updated_Punong_Barangays_Contact_Info.csv"
    tracker = Tracker(HERE / "data")
    tracker.seed(roster, args.checklist)
    hosts = {f"127.0.0.1:{args.port}", f"localhost:{args.port}"}
    try:
        server = LocalServer(("127.0.0.1", args.port), handler(tracker, hosts))
    except OSError as error:
        parser.exit(1, f"Could not start on port {args.port}. Close the existing server or choose another port. ({error})\n")
    with server:
        print(f"Open http://127.0.0.1:{args.port}", flush=True)
        server.serve_forever()
