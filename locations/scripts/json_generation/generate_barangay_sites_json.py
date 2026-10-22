"""Generate barangay_sites.json from the annotated SWMD sites CSV."""

from __future__ import annotations

import csv
import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[3]
CSV_PATH = ROOT / "locations" / "data" / "csvs" / "raw" / "Drivers - Annotated SWMD MAP - Baguio_SWMD_Google_MyMaps.csv"
OUTPUT_PATH = ROOT / "locations" / "data" / "jsons" / "barangays" / "barangay_sites.json"

WEEKDAYS = (
    "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"
)
SCHEDULE_START = re.compile(
    rf"^(?P<day>(?:(?:{WEEKDAYS})(?:\s+(?:and|,)\s+(?:{WEEKDAYS}))*|MWF|Daily|Everyday))\b(?P<rest>.*)$",
    re.IGNORECASE,
)


def schedule_entries(value: str) -> list[dict[str, dict[str, str]]]:
    """Split multiline schedule entries while preserving each source phrase."""
    lines: list[str] = []
    for raw_line in value.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if SCHEDULE_START.match(line) or not lines:
            lines.append(line)
        else:
            # Some source times wrap onto the next line without repeating a day.
            lines[-1] = f"{lines[-1]}\n{line}"

    if not lines:
        lines = [""]

    entries = []
    for line in lines:
        match = SCHEDULE_START.match(line)
        if match:
            day = match.group("day").strip()
            time = match.group("rest").strip()
            time = re.sub(r"\s+", " ", time)
        else:
            # Keep unrecognized schedule text visible rather than dropping it.
            day = ""
            time = line
        entries.append({"pick-up": {"day": day, "time": time}})
    return entries


def current_timestamp() -> str:
    now = datetime.now(ZoneInfo("Asia/Manila"))
    hour = now.hour % 12 or 12
    meridiem = "AM" if now.hour < 12 else "PM"
    return f"{now.day:02d}/{now.month:02d}/{now.year} {hour}:{now.minute:02d} {meridiem}"


def read_sites() -> list[dict]:
    last_updated = current_timestamp()
    sites = []
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        headers = next(reader, None)
        if headers is None:
            raise ValueError(f"CSV is empty: {CSV_PATH}")

        required = {
            "Site Name": 0,
            "Barangay": 1,
            "Purok": 2,
            "Schedule": 3,
            "Latitude": 4,
            "Longitude": 5,
            "Google Maps": 6,
            "Status": 10,
        }
        for name, index in required.items():
            if len(headers) <= index or headers[index].strip() != name:
                raise ValueError(f"Expected {name!r} in CSV column {index + 1}, got {headers}")
        if len(headers) <= 9 or headers[9].strip():
            raise ValueError("Expected the remarks source column to be the unnamed column after Street View")

        for row_number, row in enumerate(reader, start=2):
            if len(row) < 11:
                raise ValueError(f"CSV row {row_number} has only {len(row)} columns")
            get = lambda index: row[index].strip()
            sites.append(
                {
                    "site_name": get(0),
                    "barangay": {"name": get(1), "purok": get(2)},
                    "schedule": schedule_entries(get(3))
                    + [{"drop-off": {"day": "", "time": ""}}],
                    "location": {
                        "latitude": get(4),
                        "longitude": get(5),
                        "google_maps_url": get(6),
                    },
                    "status": {"type": get(10), "last_updated": last_updated},
                    "remarks": get(9),
                }
            )
    return sites


def main() -> None:
    sites = read_sites()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(sites, indent=4, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(sites)} sites to {OUTPUT_PATH}")
    print(f"Status last_updated: {sites[0]['status']['last_updated'] if sites else 'n/a'}")


if __name__ == "__main__":
    main()
