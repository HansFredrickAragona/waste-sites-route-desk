"""Build v5 with one cleaned collection-area name per driver/day.

Run ``--seed`` once to copy the reviewed v4 checklist into an independent v5
checklist and record the Celestial Village site update. Edit the v5 checklist
for later mapping decisions, then run this script without arguments.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import OrderedDict
from copy import deepcopy
from pathlib import Path

import build_driver_schedule_v4 as v4


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
CHECKLIST_V4 = DATA_DIR / "csvs" / "mapping" / "schedule_area_research_v4.csv"
CHECKLIST_V5 = DATA_DIR / "csvs" / "mapping" / "schedule_area_research_v5.csv"
AUDIT_V5 = DATA_DIR / "csvs" / "mapping" / "mapping_audit_swmd_v5.csv"
SOURCE_V5 = DATA_DIR / "jsons" / "schedules" / "driver_schedule_v5.json"
DEMO_V5 = DATA_DIR.parent / "demo" / "public" / "data" / "schedules" / "driver_schedule_v5.json"


def seed_checklist() -> None:
    if CHECKLIST_V5.exists():
        raise FileExistsError(f"Refusing to overwrite reviewed v5 checklist: {CHECKLIST_V5}")
    with CHECKLIST_V4.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames
        rows = list(reader)
    if not fields:
        raise ValueError("The v4 checklist has no field names")

    celestial = [row for row in rows if row["area_name_exact"] == "Celestial to Belshang"]
    if len(celestial) != 1:
        raise ValueError("Expected one Celestial to Belshang checklist row")
    row = celestial[0]
    row.update({
        "selected_source_rows": "27",
        "candidate_source_rows": "27",
        "verified_barangay": "Asin Road",
        "fallback_barangay": "Asin Road",
        "fallback_marker": "firingline",
        "researched_location": "Celestial Village toward Belshang Lodge on Asin Road; the complete route extent is not established.",
        "selected_site_or_fallback": "SWMD row 27 at Celestial Village; firing line retained for the remaining route",
        "reference_point_method": "SWMD row 27 reverse-map label identifies Celestial Village; remaining route has no confirmed line geometry.",
        "distance_to_selected_coordinate_km": "SWMD row 27 selected; remaining route extent not established.",
        "matching_rationale": "SWMD row 27 maps to Celestial Village in Asin Road. The remaining route toward Belshang has no confirmed SWMD site or line geometry.",
        "review_note": "The Celestial Village site is mapped, but the route toward Belshang still needs review.",
        "needs_review": "Yes",
    })
    sources = [source.strip() for source in row.get("research_source", "").split("; ") if source.strip()]
    for source in (
        "https://mapcarta.com/W209980692",
        "https://www.waze.com/live-map/directions/philippines/cordillera-administrative-region/baguio/belshang-apartment?to=place.ChIJKw_UOtmhkTMRNmX3w96n10c",
    ):
        if source not in sources:
            sources.append(source)
    row["research_source"] = "; ".join(sources)

    CHECKLIST_V5.parent.mkdir(parents=True, exist_ok=True)
    with CHECKLIST_V5.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Created {CHECKLIST_V5} with {len(rows)} reviewed area labels")


def cleaned_day_names() -> dict[tuple[str, str], str]:
    names = {}
    with v4.CLEANED_DRIVER_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (v4.area_key(row["Driver"]), v4.area_key(row["day"]))
            if key in names:
                raise ValueError(f"Duplicate cleaned driver/day: {key}")
            names[key] = row["collection"].strip()
    return names


def selected_site_ids(research: dict[str, dict], by_id: dict[int, dict]) -> dict[str, dict[tuple, int]]:
    selected = {}
    for area_name, decision in research.items():
        choices = {}
        groups = v4.grouped_selected_rows(v4.parse_row_ids(decision.get("selected_source_rows", "")), by_id)
        for barangay, rows in groups.items():
            for row in rows:
                key = (barangay, row["site_name"], round(row["latitude"], 6), round(row["longitude"], 6))
                choices[key] = row["source_csv_row"]
        selected[area_name] = choices
    return selected


def add_source_ids(flat_schedule: list[dict], source_ids: dict[str, dict[tuple, int]]) -> None:
    for driver in flat_schedule:
        for day in driver.get("schedule", []):
            for area in day.get("area", []):
                choices = source_ids[v4.area_key(area.get("area_name", ""))]
                for site in area.get("sites", []):
                    if site.get("latitude") is None or site.get("longitude") is None:
                        continue
                    key = (
                        area.get("barangay", ""),
                        site.get("site_name", ""),
                        round(float(site["latitude"]), 6),
                        round(float(site["longitude"]), 6),
                    )
                    if key not in choices:
                        raise ValueError(f"Mapped site has no selected SWMD row: {area.get('area_name')}, {key}")
                    site["source_csv_row"] = choices[key]


def day_details(flat_areas: list[dict]) -> list[dict]:
    groups: OrderedDict[tuple[str, str], dict] = OrderedDict()
    seen_sites: dict[tuple[str, str], set[int]] = {}
    for area in flat_areas:
        area_name = v4.area_key(area.get("area_name", ""))
        barangay = v4.area_key(area.get("barangay", ""))
        group_key = ("barangay", v4.name_key(barangay)) if barangay else ("unmapped", v4.name_key(area_name))
        if group_key not in groups:
            group = {"barangay": barangay, "sites": [], "pick up time": "", "source_areas": []}
            if not barangay:
                group["route_segment"] = area_name
            groups[group_key] = group
            seen_sites[group_key] = set()
        group = groups[group_key]
        if area_name and area_name not in group["source_areas"]:
            group["source_areas"].append(area_name)

        for site in area.get("sites", []):
            if site.get("latitude") is None or site.get("longitude") is None:
                segment = {
                    "name": area_name,
                    "type": "route" if site.get("site_name", "").strip().casefold() == "firingline" else "area",
                }
                group.setdefault("unmapped_segments", [])
                if segment not in group["unmapped_segments"]:
                    group["unmapped_segments"].append(segment)
                continue
            source_id = site["source_csv_row"]
            if source_id not in seen_sites[group_key]:
                group["sites"].append(deepcopy(site))
                seen_sites[group_key].add(source_id)

        pickup = v4.area_key(area.get("pick up time", ""))
        if pickup:
            times = [value for value in group["pick up time"].split("; ") if value]
            if pickup.casefold() not in {value.casefold() for value in times}:
                times.append(pickup)
            group["pick up time"] = "; ".join(times)
    return list(groups.values())


def build_v5(flat_schedule: list[dict], day_names: dict[tuple[str, str], str]) -> list[dict]:
    output = deepcopy(flat_schedule)
    seen = set()
    for driver in output:
        for day in driver.get("schedule", []):
            key = (v4.area_key(driver.get("driver", "")), v4.area_key(day.get("day", "")))
            if key not in day_names or key in seen:
                raise ValueError(f"Missing or duplicate cleaned driver/day: {key}")
            seen.add(key)
            name = day_names[key]
            details = day_details(day.get("area", []))
            if name.casefold() == "off" and details:
                raise ValueError(f"OFF day has area details: {key}")
            if name.casefold() != "off" and not details:
                raise ValueError(f"Scheduled day has no area details: {key}")
            if re.search(r"\bqrt\b", name, re.IGNORECASE):
                day["area"] = {
                    "name": "QRT",
                    "type": "relief",
                    "details": [],
                    "source_area_name": name,
                    "source_details": details,
                }
            else:
                day["area"] = {"name": name, "details": details}
    if seen != set(day_names):
        raise ValueError(f"Cleaned driver/day rows missing from v5: {sorted(set(day_names) - seen)[:10]}")
    return output


def write_audit(records: list[dict]) -> None:
    converted = [
        {("v5_status" if key == "v4_status" else key): value for key, value in row.items()}
        for row in records
    ]
    AUDIT_V5.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_V5.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(converted[0]))
        writer.writeheader()
        writer.writerows(converted)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", action="store_true", help="Create the independent v5 checklist from reviewed v4 decisions")
    args = parser.parse_args()
    if args.seed:
        seed_checklist()
        return
    if not CHECKLIST_V5.exists():
        raise FileNotFoundError(f"Missing {CHECKLIST_V5}; run with --seed first")

    v3 = json.loads(v4.V3_PATH.read_text(encoding="utf-8-sig"))
    swmd_rows, by_id = v4.load_swmd()
    research = v4.read_checklist(CHECKLIST_V5)
    flat, audit = v4.build_v4(v3, swmd_rows, by_id, v4.load_lookup_by_row(), research)
    v4.validate_outputs(v3, flat, audit, by_id, research)
    add_source_ids(flat, selected_site_ids(research, by_id))
    output = build_v5(flat, cleaned_day_names())
    serialized = json.dumps(output, indent=2, ensure_ascii=False) + "\n"
    SOURCE_V5.parent.mkdir(parents=True, exist_ok=True)
    DEMO_V5.parent.mkdir(parents=True, exist_ok=True)
    SOURCE_V5.write_text(serialized, encoding="utf-8")
    DEMO_V5.write_text(serialized, encoding="utf-8")
    write_audit(audit)
    print(f"Wrote {SOURCE_V5}")
    print(f"Wrote {DEMO_V5}")
    print(f"Wrote {AUDIT_V5}: {len(audit)} SWMD source rows")


if __name__ == "__main__":
    main()
