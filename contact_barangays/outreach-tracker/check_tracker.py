from pathlib import Path
from tempfile import TemporaryDirectory
from server import Tracker

root = Path(__file__).resolve().parents[2]
source = root / "locations/data/csvs/raw/Updated_Punong_Barangays_Contact_Info.csv"

(Path(__file__).resolve().parent / "data").mkdir(exist_ok=True)
with TemporaryDirectory(dir=Path(__file__).resolve().parent / "data") as folder:
    tracker = Tracker(Path(folder))
    tracker.seed(source)
    assert len(tracker.state()["barangays"]) == 128
    tracker.outreach("8", "Yes", "Yes")
    tracker.meeting({"Barangay": "Atok Trail", "Meeting date": "2026-11-05", "Time": "11:10 AM", "Status": "Complete"})
    tracker.meeting({"Barangay": "Atok Trail", "Meeting date": "2026-11-06", "Time": "3:00 PM", "Status": "Scheduled"})
    state = Tracker(Path(folder)).state()
    assert [row["Status"] for row in state["meetings"]] == ["Complete", "Scheduled"]
    row = next(row for row in state["barangays"] if row["No."] == "8")
    assert (row["Email sent"], row["isreplied"], row["isMeeting"]) == ("Yes", "Yes", "Yes")
    for field in ("Email sent", "isreplied", "isMeeting"):
        tracker.toggle_outreach("8", field)
    state = Tracker(Path(folder)).state()
    row = next(row for row in state["barangays"] if row["No."] == "8")
    assert (row["Email sent"], row["isreplied"], row["isMeeting"]) == ("No", "No", "No")
    assert len(state["meetings"]) == 2
    output = Path(folder) / "output"
    first = output / tracker.snapshot(output)
    tracker.toggle_outreach("8", "Email sent")
    second = output / tracker.snapshot(output)
    assert first != second
    assert (first / "meetings.csv").read_bytes() == (second / "meetings.csv").read_bytes()
    assert (first / "barangay-status.csv").read_bytes() != (second / "barangay-status.csv").read_bytes()
