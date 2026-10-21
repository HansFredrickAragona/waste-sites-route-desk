"""Build v6 with driver metadata and annotated SWMD site information."""

from __future__ import annotations

import csv
import json
import re
from copy import deepcopy
from pathlib import Path

import build_driver_schedule_v5 as v5


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SOURCE_V5 = DATA_DIR / "jsons" / "schedules" / "driver_schedule_v5.json"
SOURCE_V6 = DATA_DIR / "jsons" / "schedules" / "driver_schedule_v6.json"
ANNOTATED_CSV = DATA_DIR / "csvs" / "raw" / "Drivers - Annotated SWMD MAP - Baguio_SWMD_Google_MyMaps.csv"
DRIVER_DETAILS_CSV = DATA_DIR / "csvs" / "raw" / "Drivers - driver_details.csv"
DEMO_V6 = DATA_DIR.parent / "demo" / "site schedule demo" / "public" / "data" / "schedules" / "driver_schedule_v6.json"

# The cleaned schedule and the driver details sheet contain this driver's
# surname differently. Keep the cleaned schedule spelling in the output while
# using the unique corresponding row for the vehicle metadata.
DRIVER_NAME_ALIASES = {
    "QUIRAR ELPIDIO JR": "QUITOR ELPIDIO JR",
}


def name_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def read_driver_details() -> dict[str, dict]:
    details = {}
    with DRIVER_DETAILS_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            name = str(row.get("DRIVER NAME", "")).strip()
            if not name:
                continue
            key = name_key(name)
            if key in details:
                raise ValueError(f"Duplicate driver details for {name}")
            plate = str(row.get("PLATE NUMBER", "")).strip()
            driver_type = str(row.get("Type", "")).strip().casefold()
            details[key] = {
                "name": name,
                "type": driver_type,
                "truck": [plate] if plate else [],
            }
    return details


def read_annotated_sites() -> dict[int, dict]:
    sites = {}
    with ANNOTATED_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        for source_row, row in enumerate(csv.DictReader(handle), start=2):
            sites[source_row] = row
    return sites


def apply_annotation(site: dict, annotations: dict[int, dict]) -> None:
    if site.get("latitude") is None or site.get("longitude") is None:
        return
    try:
        source_row = int(site["source_csv_row"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Mapped v5 site is missing a valid source_csv_row: {site}") from exc
    annotation = annotations.get(source_row)
    if annotation is None:
        raise ValueError(f"No annotated SWMD CSV row {source_row} for mapped v5 site")

    site["source_purok"] = str(annotation.get("Purok", "")).strip()
    site["Status"] = str(annotation.get("Status", "")).strip()
    site["google_maps_url"] = str(annotation.get("Google Maps", "")).strip() or site.get("google_maps_url", "")
    for source_field, target_field in (
        ("Satellite Reference", "satellite_reference_url"),
        ("Street View", "street_view_url"),
    ):
        value = str(annotation.get(source_field, "")).strip()
        if value:
            site[target_field] = value


def build_v6() -> list[dict]:
    with SOURCE_V5.open("r", encoding="utf-8-sig") as handle:
        schedule_v5 = json.load(handle)
    drivers_by_name = read_driver_details()
    annotations_by_row = read_annotated_sites()
    output = deepcopy(schedule_v5)
    seen_driver_keys = set()

    for record in output:
        old_driver_name = record.get("driver")
        driver_name = old_driver_name if isinstance(old_driver_name, str) else str((old_driver_name or {}).get("name", ""))
        key = name_key(driver_name)
        details_key = name_key(DRIVER_NAME_ALIASES.get(driver_name.strip().upper(), driver_name))
        driver_detail = drivers_by_name.get(details_key)
        if driver_detail is None:
            raise ValueError(f"No row in driver details CSV for schedule driver {driver_name!r}")
        seen_driver_keys.add(details_key)
        record["driver"] = {
            "name": driver_name.strip(),
            "type": driver_detail["type"],
            "truck": driver_detail["truck"],
        }

        for day in record.get("schedule", []):
            area = day.get("area")
            if not isinstance(area, dict):
                continue
            for detail in area.get("details", []):
                for site in detail.get("sites", []):
                    apply_annotation(site, annotations_by_row)

    missing_drivers = set(drivers_by_name) - seen_driver_keys
    if missing_drivers:
        names = [drivers_by_name[key]["name"] for key in sorted(missing_drivers)]
        raise ValueError(f"Driver details CSV has names missing from v5: {names}")

    return output


def main() -> None:
    output = build_v6()
    serialized = json.dumps(output, indent=2, ensure_ascii=False) + "\n"
    SOURCE_V6.parent.mkdir(parents=True, exist_ok=True)
    DEMO_V6.parent.mkdir(parents=True, exist_ok=True)
    SOURCE_V6.write_text(serialized, encoding="utf-8")
    DEMO_V6.write_text(serialized, encoding="utf-8")
    print(f"Wrote {SOURCE_V6}")
    print(f"Wrote {DEMO_V6}")
    print(f"Wrote v6 with {len(output)} driver records and {sum(len(driver.get('schedule', [])) for driver in output)} day entries")


if __name__ == "__main__":
    main()
