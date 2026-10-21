"""Build driver_schedule_v4.json from v3 and a reviewed area checklist.

Run from the project root with Python 3 to recreate the reviewed checklist,
then generate the JSON and 670-row mapping audit:
    python locations/scripts/json_generation/build_driver_schedule_v4.py --seed
    python locations/scripts/json_generation/curate_driver_schedule_v4.py
    python locations/scripts/json_generation/build_driver_schedule_v4.py

The seed command creates the checklist once from v3. The curation step
reapplies the documented area decisions, barangay-filtered candidate review,
and explicit unresolved notes. The build writes only v4 artifacts and never
changes v3 or the source CSVs.

The emitted v4 JSON keeps each day's original ``area`` list. Each list item
has its own ``area_name``, barangay, sites, and pickup time. The separate demo
label file preserves the exact cleaned-driver collection text for display.
Unresolved routes keep the original null-coordinate firingline or blank site.
"""

from __future__ import annotations

import argparse
import ast
import csv
import json
import math
import re
import unicodedata
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from urllib.parse import quote_plus


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
V3_PATH = DATA_DIR / "jsons" / "schedules" / "driver_schedule_v3.json"
V4_PATH = DATA_DIR / "jsons" / "schedules" / "driver_schedule_v4.json"
CLEANED_DRIVER_PATH = DATA_DIR / "csvs" / "cleaned" / "cleaned_drivers_dataset.csv"
DEMO_V4_PATH = DATA_DIR.parent / "demo" / "public" / "data" / "schedules" / "driver_schedule_v4.json"
DEMO_AREA_LABELS_PATH = DATA_DIR.parent / "demo" / "src" / "data" / "schedules" / "cleanedDriverAreaLabels.json"
SWMD_PATH = DATA_DIR / "csvs" / "raw" / "SWMD MAP - Baguio_SWMD_Google_MyMaps.csv"
LOOKUP_PATH = DATA_DIR / "csvs" / "mapping" / "swmd_coordinate_lookup_v2.csv"
OLD_RESEARCH_PATH = DATA_DIR / "csvs" / "mapping" / "schedule_area_research_v3.csv"
CHECKLIST_PATH = DATA_DIR / "csvs" / "mapping" / "schedule_area_research_v4.csv"
AUDIT_PATH = DATA_DIR / "csvs" / "mapping" / "mapping_audit_swmd_v4.csv"
OLD_GENERATOR_PATH = Path(__file__).with_name("update_driver_json.py")

PSA_BARANGAYS = "https://psa.gov.ph/classification/psgc/barangays/1430300000"
PSA_PATTERN = re.compile(r"\s*\(\s*\d{1,2}(?:am|pm|nn)\s*-\s*\d{1,2}(?:am|pm|nn)\s*\)\s*", re.I)
ROUTE_WORDS = {
    "to", "road", "rd", "street", "st", "highway", "hwy", "drive", "bridge",
    "overpass", "junction", "intersection", "boundary", "limit", "circle", "corner",
    "corridor", "route", "up", "until", "trail", "from", "along",
}

CHECKLIST_FIELDS = [
    "area_name_exact",
    "occurrences",
    "fully_checked",
    "research_status",
    "researched_location",
    "verified_barangay",
    "candidate_source_rows",
    "candidate_sites_considered",
    "selected_source_rows",
    "selected_site_or_fallback",
    "fallback_marker",
    "fallback_barangay",
    "reference_latitude",
    "reference_longitude",
    "reference_point_method",
    "distance_to_selected_coordinate_km",
    "matching_rationale",
    "confidence",
    "research_source",
    "needs_review",
    "review_note",
]


def area_key(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clean_area(value: str) -> str:
    value = area_key(value).lower()
    value = PSA_PATTERN.sub("", value)
    return value.rstrip(",").strip()


def name_key(value: str) -> str:
    value = str(value or "")
    value = value.replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]", "", value.lower())


def site_name_key(value: str) -> str:
    return name_key(value)


def split_components(text: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    for index, char in enumerate(text):
        if char == "(":
            depth += 1
        elif char == ")" and depth:
            depth -= 1
        elif char == "," and depth == 0:
            part = text[start:index].strip()
            if part:
                parts.append(part)
            start = index + 1
    tail = text[start:].strip()
    if tail:
        parts.append(tail)
    return parts or [text]


def parse_row_ids(value: str) -> list[int]:
    result = []
    for part in str(value or "").split("|"):
        part = part.strip()
        if part:
            result.append(int(part))
    return list(dict.fromkeys(result))


def parse_barangays(value: str) -> list[str]:
    return list(dict.fromkeys(part.strip() for part in str(value or "").split("|") if part.strip()))


def parse_float(value: object) -> float | None:
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    value = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def centroid(rows: list[dict]) -> tuple[float, float] | None:
    points = [(row["latitude"], row["longitude"]) for row in rows if row.get("coordinates_valid")]
    if not points:
        return None
    return (sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points))


def load_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def load_swmd() -> tuple[list[dict], dict[int, dict]]:
    source = load_csv(SWMD_PATH)
    rows: list[dict] = []
    for index, raw in enumerate(source):
        lat = parse_float(raw.get("Latitude"))
        lon = parse_float(raw.get("Longitude"))
        valid = lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180
        rows.append({
            "source_csv_row": index + 2,
            "site_name": str(raw.get("Site Name", "")).strip(),
            "barangay": str(raw.get("Barangay", "")).strip(),
            "purok": str(raw.get("Purok", "")).strip(),
            "schedule": str(raw.get("Schedule", "")).strip(),
            "latitude": lat if valid else None,
            "longitude": lon if valid else None,
            "coordinates_valid": valid,
            "google_maps": str(raw.get("Google Maps", "")).strip(),
        })
    lookup_by_row: dict[int, dict] = {}
    if LOOKUP_PATH.exists():
        for lookup in load_csv(LOOKUP_PATH):
            try:
                source_id = int(float(lookup.get("source_csv_row", "")))
            except (TypeError, ValueError):
                continue
            lookup_by_row[source_id] = lookup
    return rows, {row["source_csv_row"]: row for row in rows}


def source_match_index(rows: list[dict]) -> dict[tuple[str, float, float], list[dict]]:
    index: dict[tuple[str, float, float], list[dict]] = defaultdict(list)
    for row in rows:
        if not row["coordinates_valid"]:
            continue
        key = (site_name_key(row["site_name"]), round(row["latitude"], 6), round(row["longitude"], 6))
        index[key].append(row)
    return index


def source_identity(row: dict) -> tuple[str, str, float, float]:
    return (
        name_key(row["barangay"]),
        site_name_key(row["site_name"]),
        round(row["latitude"], 6),
        round(row["longitude"], 6),
    )


def canonical_alias_tables() -> tuple[dict[str, str], dict[str, list[tuple[str | None, str]]]]:
    if not OLD_GENERATOR_PATH.exists():
        return {}, {}
    tree = ast.parse(OLD_GENERATOR_PATH.read_text(encoding="utf-8"))
    values = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            key = node.targets[0].id
            if key in {"PART_ALIASES", "FULL_ALIASES"}:
                values[key] = ast.literal_eval(node.value)
    parts = {clean_area(key): value for key, value in values.get("PART_ALIASES", {}).items()}
    full = {clean_area(key): value for key, value in values.get("FULL_ALIASES", {}).items()}
    return parts, full


def map_alias_to_csv(alias: str, canonical_by_key: dict[str, str]) -> str:
    return canonical_by_key.get(name_key(alias), "")


def get_alias_barangays(area: str, parents: list[str], rows_by_name: dict[str, str], part_aliases: dict, full_aliases: dict) -> list[str]:
    expected: list[str] = []
    direct = rows_by_name.get(name_key(area), "")
    if direct:
        expected.append(direct)
    part = part_aliases.get(clean_area(area))
    if part:
        mapped = map_alias_to_csv(part, rows_by_name)
        if mapped:
            expected.append(mapped)
    for parent in parents:
        for barangay, raw_part in full_aliases.get(clean_area(parent), []):
            if barangay and clean_area(raw_part) == clean_area(area):
                mapped = map_alias_to_csv(barangay, rows_by_name)
                if mapped:
                    expected.append(mapped)
    return list(dict.fromkeys(expected))


def is_corridor(value: str) -> bool:
    words = set(re.findall(r"[a-z0-9]+", clean_area(value)))
    return bool(words & ROUTE_WORDS)


def is_broad_label(value: str, canonical: str, aliases: list[str]) -> bool:
    if is_corridor(value):
        return False
    keys = {name_key(value), *(name_key(alias) for alias in aliases)}
    return name_key(canonical) in keys or name_key(value) == name_key(canonical)


def query_url(area: str) -> str:
    return "https://www.google.com/maps/search/?api=1&query=" + quote_plus(f"{area}, Baguio City, Benguet")


def unique_rows_for_site_object(site: dict, match_index: dict, verified: list[str]) -> list[dict]:
    if site.get("latitude") is None or site.get("longitude") is None:
        return []
    key = (site_name_key(site.get("site_name", "")), round(float(site["latitude"]), 6), round(float(site["longitude"]), 6))
    choices = match_index.get(key, [])
    if verified:
        verified_keys = {name_key(value) for value in verified}
        choices = [row for row in choices if name_key(row["barangay"]) in verified_keys]
    return choices


def record_preview(row_ids: list[int], by_id: dict[int, dict], reference: tuple[float, float] | None) -> str:
    items = []
    for source_id in row_ids:
        row = by_id[source_id]
        coords = "null,null" if not row["coordinates_valid"] else f"{row['latitude']:.6f},{row['longitude']:.6f}"
        distance = ""
        if reference and row["coordinates_valid"]:
            distance = f" ({distance_km(reference[0], reference[1], row['latitude'], row['longitude']):.3f} km)"
        items.append(f"{source_id}: {row['site_name']} [{row['barangay']}] {coords}{distance}")
    return "; ".join(items)


def seed_checklist(v3: list[dict], rows: list[dict], by_id: dict[int, dict]) -> list[dict]:
    old_research = {area_key(row.get("area_name_exact", "")): row for row in load_csv(OLD_RESEARCH_PATH)}
    part_aliases, full_aliases = canonical_alias_tables()
    canonical_by_key = {name_key(row["barangay"]): row["barangay"] for row in rows if row["barangay"]}
    all_area_occurrences: dict[str, list[dict]] = defaultdict(list)
    for driver in v3:
        for day in driver.get("schedule", []):
            for area in day.get("area", []):
                all_area_occurrences[area_key(area.get("area_name", ""))].append(area)

    parent_components: dict[str, list[str]] = defaultdict(list)
    for research in load_csv(OLD_RESEARCH_PATH):
        parent = area_key(research.get("area_name_exact", ""))
        for component in split_components(parent):
            parent_components[area_key(component)].append(parent)

    match_index = source_match_index(rows)
    seeded: list[dict] = []
    for label, occurrences in sorted(all_area_occurrences.items(), key=lambda item: item[0].casefold()):
        parents = list(dict.fromkeys(parent_components.get(label, [])))
        expected = get_alias_barangays(label, parents, canonical_by_key, part_aliases, full_aliases)
        old_site_rows: list[dict] = []
        old_fallbacks: list[str] = []
        for occurrence in occurrences:
            for site in occurrence.get("sites", []):
                marker = str(site.get("site_name", ""))
                if site.get("latitude") is None or site.get("longitude") is None:
                    if marker == "firingline":
                        old_fallbacks.append("firingline")
                    elif marker == "":
                        old_fallbacks.append("blank")
                    continue
                old_site_rows.extend(unique_rows_for_site_object(site, match_index, expected))

        # If the existing v3 coordinates do not prove a row, accept the exact
        # CSV/PSGC alias only as a candidate. A reviewer must still approve it.
        actual_from_old = list(dict.fromkeys(row["barangay"] for row in old_site_rows))
        verified = expected or actual_from_old
        selected = []
        if old_site_rows:
            selected = list({source_identity(row): row for row in old_site_rows if row["coordinates_valid"]}.values())
        elif len(verified) == 1 and is_broad_label(label, verified[0], [verified[0]]):
            selected = [row for row in rows if row["barangay"] == verified[0] and row["coordinates_valid"]]
            selected = list({source_identity(row): row for row in selected}.values())

        # Keep only candidates whose source Barangay matches a verified alias.
        if expected:
            allowed = {name_key(value) for value in expected}
            selected = [row for row in selected if name_key(row["barangay"]) in allowed]
            verified = expected
        elif not verified and old_site_rows:
            verified = actual_from_old

        # Broad-area candidates are all filtered rows. Narrow roads, puroks and
        # landmark labels keep only the old candidate rows pending review.
        if verified:
            allowed = {name_key(value) for value in verified}
            candidates = [row for row in rows if name_key(row["barangay"]) in allowed]
        else:
            candidate_ids = {row["source_csv_row"] for row in old_site_rows}
            candidates = [row for row in rows if row["source_csv_row"] in candidate_ids]

        selected = list({source_identity(row): row for row in selected}.values())
        selected.sort(key=lambda row: row["source_csv_row"])
        candidates.sort(key=lambda row: row["source_csv_row"])
        selected_ids = [row["source_csv_row"] for row in selected]
        candidate_ids = [row["source_csv_row"] for row in candidates]
        ref = centroid(selected) or centroid(candidates)

        fallback = "none"
        if old_fallbacks:
            fallback = "firingline" if "firingline" in old_fallbacks else "blank"
        elif not selected:
            fallback = "firingline" if is_corridor(label) else "blank"
        fallback_barangay = verified[0] if len(verified) == 1 else ""

        parent_research = [old_research[p] for p in parents if p in old_research]
        likely_locations = list(dict.fromkeys(row.get("likely_location", "") for row in parent_research if row.get("likely_location")))
        map_labels = list(dict.fromkeys(
            str((load_lookup(by_id[row_id]["source_csv_row"]) or {}).get("reverse_geocode_label", "")).strip()
            for row_id in selected_ids
            if load_lookup(by_id[row_id]["source_csv_row"]) and (load_lookup(by_id[row_id]["source_csv_row"]) or {}).get("reverse_geocode_label")
        ))
        location = " | ".join(likely_locations[:2]) or ("; ".join(map_labels[:3]) if map_labels else f"{label}, Baguio City, Benguet; exact local boundary not independently established")
        source_urls = [query_url(label), PSA_BARANGAYS]
        for parent_row in parent_research:
            source_urls.extend(url.strip() for url in parent_row.get("research_source_urls", "").split(";"))
        for row in selected[:5]:
            if row.get("google_maps"):
                source_urls.append(row["google_maps"])
        source_urls = list(dict.fromkeys(url for url in source_urls if url))

        if selected:
            rationale = "Existing v3 coordinate candidates were resolved to source CSV rows and filtered to the listed barangay value(s); location and route fit still require the checklist review."
        elif verified:
            rationale = "The area has a candidate barangay alias, but no reviewed coordinate is assigned from the v3 matches. The filtered rows are listed for map review; a null-coordinate fallback is retained."
        else:
            rationale = "No defensible barangay or site point was recovered from v3; review the area location and determine whether a filtered SWMD match exists."

        seeded.append({
            "area_name_exact": label,
            "occurrences": len(occurrences),
            "fully_checked": "No",
            "research_status": "needs_review",
            "researched_location": location,
            "verified_barangay": "|".join(verified),
            "candidate_source_rows": "|".join(str(value) for value in candidate_ids),
            "candidate_sites_considered": record_preview(candidate_ids, by_id, ref),
            "selected_source_rows": "|".join(str(value) for value in selected_ids),
            "selected_site_or_fallback": record_preview(selected_ids, by_id, ref) if selected_ids else f"{fallback} marker; coordinates null",
            "fallback_marker": fallback,
            "fallback_barangay": fallback_barangay,
            "reference_latitude": "" if ref is None else f"{ref[0]:.8f}",
            "reference_longitude": "" if ref is None else f"{ref[1]:.8f}",
            "reference_point_method": "v3 SWMD candidate centroid; provisional, not an independent place geocode" if ref else "No reference point found",
            "distance_to_selected_coordinate_km": record_preview(selected_ids, by_id, ref),
            "matching_rationale": rationale,
            "confidence": "Low",
            "research_source": "; ".join(source_urls),
            "needs_review": "Yes",
            "review_note": "Seeded from v3 and the source CSV. Confirm the location, canonical barangay spelling, filtered coordinate candidates, and distances before marking complete.",
        })
    return seeded


def load_lookup_by_row() -> dict[int, dict]:
    by_row = {}
    if not LOOKUP_PATH.exists():
        return by_row
    for row in load_csv(LOOKUP_PATH):
        try:
            by_row[int(float(row.get("source_csv_row", "")))] = row
        except (TypeError, ValueError):
            continue
    return by_row


def write_checklist(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CHECKLIST_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


def read_checklist(path: Path) -> dict[str, dict]:
    records = load_csv(path)
    result: dict[str, dict] = {}
    for row in records:
        key = area_key(row.get("area_name_exact", ""))
        if not key:
            continue
        if key in result:
            raise ValueError(f"Duplicate checklist area label after whitespace normalization: {key}")
        result[key] = row
    return result


def row_site_object(row: dict, lookup: dict, old_sites: list[dict]) -> dict:
    result = {
        "site_name": row["site_name"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
    }
    alias_fields = {
        "source_purok": ("Purok", row.get("purok", "")),
        "purok_candidate": ("purok_candidate", ""),
        "purok_check": ("purok_check", ""),
        "street_or_road": ("street_or_road", ""),
        "map_label": ("reverse_geocode_label", ""),
        "map_lookup_status": ("lookup_status", ""),
        "map_lookup_url": ("research_source", ""),
        "google_maps_url": ("source_google_maps_url", row.get("google_maps", "")),
    }
    old_by_name_coord = {}
    for old in old_sites:
        if old.get("latitude") is not None and old.get("longitude") is not None:
            key = (site_name_key(old.get("site_name", "")), round(float(old["latitude"]), 6), round(float(old["longitude"]), 6))
            old_by_name_coord[key] = old
    site_key = (site_name_key(row["site_name"]), round(row["latitude"], 6), round(row["longitude"], 6))
    prior = old_by_name_coord.get(site_key, {})
    for output_key, (lookup_key, default_value) in alias_fields.items():
        value = str(lookup.get(lookup_key, "") or default_value or "").strip()
        if output_key == "map_label" and prior.get("map_label"):
            value = str(prior["map_label"]).strip()
        if value:
            result[output_key] = value
    return result


def grouped_selected_rows(ids: list[int], by_id: dict[int, dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    seen = set()
    for source_id in ids:
        row = by_id[source_id]
        if not row["coordinates_valid"]:
            raise ValueError(f"Invalid-coordinate SWMD row {source_id} cannot be selected")
        identity = source_identity(row)
        if identity in seen:
            continue
        seen.add(identity)
        groups[row["barangay"]].append(row)
    for values in groups.values():
        values.sort(key=lambda item: item["source_csv_row"])
    return dict(sorted(groups.items(), key=lambda item: item[0].casefold()))


def valid_decision(row: dict, selected_rows: list[dict], by_id: dict[int, dict]) -> None:
    fully_checked = row.get("fully_checked", "").strip().lower() == "yes"
    verified = parse_barangays(row.get("verified_barangay", ""))
    marker = row.get("fallback_marker", "").strip().lower()
    if marker not in {"firingline", "blank", "none"}:
        raise ValueError(f"Invalid fallback_marker {marker!r} for {row['area_name_exact']!r}")
    if not selected_rows and marker == "none":
        raise ValueError(f"Area {row['area_name_exact']!r} has no site and no fallback marker")
    if fully_checked and (not row.get("researched_location", "").strip() or not verified or not row.get("research_source", "").strip()):
        raise ValueError(f"Area {row['area_name_exact']!r} is marked complete without location, barangay, and source")
    verified_keys = {name_key(value) for value in verified}
    for source_id in parse_row_ids(row.get("selected_source_rows", "")):
        if source_id not in by_id:
            raise ValueError(f"Unknown selected SWMD row {source_id} for {row['area_name_exact']!r}")
        site = by_id[source_id]
        if verified_keys and name_key(site["barangay"]) not in verified_keys:
            raise ValueError(
                f"Selected row {source_id} belongs to {site['barangay']!r}, outside verified barangay list for {row['area_name_exact']!r}"
            )
    selected_canonical = {name_key(site["barangay"]) for site in selected_rows}
    if verified_keys and not selected_canonical.issubset(verified_keys):
        raise ValueError(f"Area {row['area_name_exact']!r} selects a row outside its verified barangay list")


def make_fallback(marker: str) -> dict:
    return {
        "site_name": "firingline" if marker == "firingline" else "",
        "latitude": None,
        "longitude": None,
    }


def make_output_area(original: dict, barangay: str, sites: list[dict]) -> dict:
    result = deepcopy(original)
    result["barangay"] = barangay
    result["sites"] = sites
    return result


def nest_day_areas(areas: list[dict]) -> dict:
    """Put the day label once above its barangay-level schedule details."""
    area_names: list[str] = []
    detail_groups: dict[str, dict] = {}
    seen_sites: dict[str, set] = defaultdict(set)
    for area in areas:
        area_name = str(area.get("area_name", "")).strip()
        if area_name and area_name.casefold() not in {name.casefold() for name in area_names}:
            area_names.append(area_name)

        barangay = str(area.get("barangay", "")).strip()
        unmapped_segments = area.get("unmapped_segments", [])
        key = area_key(barangay).casefold() or f"__unmapped__::{name_key(area_name)}"
        if key not in detail_groups:
            detail_groups[key] = {"barangay": barangay, "sites": [], "pick up time": ""}
            if not barangay:
                detail_groups[key]["route_segment"] = area_name

        group = detail_groups[key]
        for site in area.get("sites", []):
            source_id = site.get("source_csv_row")
            site_key = source_id if source_id is not None else (
                site.get("site_name"), site.get("latitude"), site.get("longitude")
            )
            if site_key not in seen_sites[key]:
                group["sites"].append(deepcopy(site))
                seen_sites[key].add(site_key)
        if unmapped_segments:
            group.setdefault("unmapped_segments", [])
            for segment in unmapped_segments:
                if segment not in group["unmapped_segments"]:
                    group["unmapped_segments"].append(deepcopy(segment))
        pickup_time = str(area.get("pick up time", "")).strip()
        if pickup_time:
            times = [value for value in group["pick up time"].split("; ") if value]
            if pickup_time.casefold() not in {value.casefold() for value in times}:
                times.append(pickup_time)
            group["pick up time"] = "; ".join(times)

    return {"name": ", ".join(area_names), "details": list(detail_groups.values())}


def load_cleaned_day_areas() -> dict[tuple[str, str], str]:
    """Keep the displayed day labels identical to the cleaned driver dataset."""
    labels = {}
    with CLEANED_DRIVER_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            key = (area_key(row["Driver"]), area_key(row["day"]))
            if key in labels:
                raise ValueError(f"Duplicate cleaned driver/day row: {key}")
            labels[key] = area_key(row["collection"])
    return labels


def validate_cleaned_day_areas(schedule: list[dict], cleaned_day_areas: dict[tuple[str, str], str]) -> None:
    seen = set()
    for driver in schedule:
        for day in driver.get("schedule", []):
            key = (area_key(driver.get("driver", "")), area_key(day.get("day", "")))
            if key not in cleaned_day_areas:
                raise ValueError(f"No cleaned driver/day row for {key}")
            if key in seen:
                raise ValueError(f"Duplicate v4 driver/day row: {key}")
            seen.add(key)
            nested = nest_day_areas(day.get("area", []))
            cleaned_name = cleaned_day_areas[key]
            if cleaned_name.casefold() != "off" and name_key(nested["name"]) != name_key(cleaned_name):
                raise ValueError(f"Area label differs from the cleaned driver dataset for {key}")
            if cleaned_name.casefold() == "off" and nested["details"]:
                raise ValueError(f"OFF day has schedule details for {key}")
    if seen != set(cleaned_day_areas):
        raise ValueError(f"Cleaned driver/day rows missing from v4: {sorted(set(cleaned_day_areas) - seen)[:10]}")


def write_demo_area_labels(cleaned_day_areas: dict[tuple[str, str], str]) -> None:
    labels: dict[str, dict[str, str]] = defaultdict(dict)
    for (driver, day), collection in cleaned_day_areas.items():
        labels[driver][day] = collection
    DEMO_AREA_LABELS_PATH.write_text(
        json.dumps(labels, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def build_v4(v3: list[dict], swmd_rows: list[dict], by_id: dict[int, dict], lookup_by_row: dict[int, dict], research: dict[str, dict]) -> tuple[list[dict], list[dict]]:
    expected_labels = {
        area_key(area.get("area_name", ""))
        for driver in v3
        for day in driver.get("schedule", [])
        for area in day.get("area", [])
    }
    missing = expected_labels - set(research)
    extra = set(research) - expected_labels
    if missing or extra:
        raise ValueError(f"Checklist mismatch: missing={sorted(missing)[:10]}, extra={sorted(extra)[:10]}")

    lookup = {row_id: lookup_by_row.get(row_id, {}) for row_id in by_id}
    area_assignments: dict[str, dict] = {}
    selected_to_area: dict[int, list[str]] = defaultdict(list)
    candidate_to_area: dict[int, list[str]] = defaultdict(list)
    distances_by_area: dict[str, dict[int, float]] = defaultdict(dict)
    selected_by_area: dict[str, list[dict]] = {}

    for key, decision in research.items():
        selected_ids = parse_row_ids(decision.get("selected_source_rows", ""))
        candidate_ids = parse_row_ids(decision.get("candidate_source_rows", ""))
        selected_rows = [by_id[source_id] for source_id in selected_ids if source_id in by_id]
        valid_decision(decision, selected_rows, by_id)
        selected_by_area[key] = selected_rows
        for source_id in selected_ids:
            selected_to_area[source_id].append(key)
        for source_id in candidate_ids:
            if source_id in by_id:
                candidate_to_area[source_id].append(key)
        ref_lat = parse_float(decision.get("reference_latitude"))
        ref_lon = parse_float(decision.get("reference_longitude"))
        if ref_lat is None or ref_lon is None:
            continue
        for source_id in set(selected_ids + candidate_ids):
            row = by_id.get(source_id)
            if row and row["coordinates_valid"]:
                distances_by_area[key][source_id] = distance_km(ref_lat, ref_lon, row["latitude"], row["longitude"])

    output = deepcopy(v3)
    for driver in output:
        for day in driver.get("schedule", []):
            rebuilt_areas = []
            for original in day.get("area", []):
                label = str(original.get("area_name", ""))
                key = area_key(label)
                decision = research[key]
                selected_rows = selected_by_area[key]
                groups = grouped_selected_rows(parse_row_ids(decision.get("selected_source_rows", "")), by_id)
                marker = decision.get("fallback_marker", "").strip().lower()
                fallback_barangay = decision.get("fallback_barangay", "").strip()
                if groups:
                    for barangay, group_rows in groups.items():
                        sites = [row_site_object(row, lookup[row["source_csv_row"]], original.get("sites", [])) for row in group_rows]
                        rebuilt_areas.append(make_output_area(original, barangay, sites))
                    if marker in {"firingline", "blank"}:
                        rebuilt_areas.append(make_output_area(original, fallback_barangay, [make_fallback(marker)]))
                else:
                    if marker not in {"firingline", "blank"}:
                        raise ValueError(f"Area {label!r} has no selected rows or fallback")
                    verified = parse_barangays(decision.get("verified_barangay", ""))
                    barangay = fallback_barangay or (verified[0] if len(verified) == 1 else "")
                    rebuilt_areas.append(make_output_area(original, barangay, [make_fallback(marker)]))
            day["area"] = rebuilt_areas

    audit = []
    for row in swmd_rows:
        source_id = row["source_csv_row"]
        matched_keys = selected_to_area.get(source_id, [])
        candidate_keys = candidate_to_area.get(source_id, [])
        unique_key = source_identity(row) if row["coordinates_valid"] else None
        duplicate_rows = []
        if unique_key:
            duplicate_rows = [
                other["source_csv_row"]
                for other in swmd_rows
                if other["source_csv_row"] < source_id and other["coordinates_valid"] and source_identity(other) == unique_key
            ]
        if matched_keys:
            status = "matched"
            rationale = "Selected by the reviewed area checklist after filtering to the source CSV barangay."
        elif duplicate_rows and any(selected_to_area.get(prev) for prev in duplicate_rows):
            status = "duplicate_of_selected_row"
            matched_keys = list(dict.fromkeys(key for prev in duplicate_rows for key in selected_to_area.get(prev, [])))
            rationale = f"Duplicate source record at the same barangay, site name, and coordinate as row(s) {', '.join(map(str, duplicate_rows))}; retained in audit but deduplicated in JSON."
        elif not row["coordinates_valid"]:
            status = "unmatched_invalid_coordinate"
            rationale = "Source row has a missing or invalid coordinate and cannot be emitted as a confirmed site."
        elif candidate_keys:
            status = "reviewed_unselected"
            rationale = "This row was in the verified-barangay candidate set but was not selected for the researched area location."
        else:
            status = "unmatched"
            rationale = "No reviewed v4 area selects this SWMD row. It remains accounted for and unassigned."

        all_area_keys = list(dict.fromkeys(matched_keys + candidate_keys))
        area_names = [research[key]["area_name_exact"] for key in all_area_keys]
        selected_detail = []
        confidence = []
        sources = [row.get("google_maps", "")]
        area_distances = []
        human_review = False
        for key in all_area_keys:
            decision = research[key]
            is_selected = key in selected_to_area.get(source_id, [])
            if is_selected:
                selected_detail.append(f"{decision['area_name_exact']} ({row['barangay']})")
            confidence.append(decision.get("confidence", "Low"))
            sources.extend(url.strip() for url in decision.get("research_source", "").split(";"))
            if source_id in distances_by_area.get(key, {}):
                area_distances.append(f"{decision['area_name_exact']}: {distances_by_area[key][source_id]:.3f}")
            if decision.get("needs_review", "Yes").strip().lower() == "yes" or decision.get("fully_checked", "No").strip().lower() != "yes":
                human_review = True

        audit.append({
            "source_csv_row": source_id,
            "site_name": row["site_name"],
            "swmd_barangay": row["barangay"],
            "purok": row["purok"],
            "schedule": row["schedule"],
            "latitude": "" if row["latitude"] is None else row["latitude"],
            "longitude": "" if row["longitude"] is None else row["longitude"],
            "coordinate_status": "valid" if row["coordinates_valid"] else "missing_or_invalid",
            "v4_status": status,
            "selected_schedule_area": "; ".join(dict.fromkeys(selected_detail)),
            "candidate_schedule_area": "; ".join(dict.fromkeys(area_names)),
            "distance_to_area_reference_km": "; ".join(area_distances),
            "matching_rationale": " | ".join(dict.fromkeys([rationale] + [research[key].get("matching_rationale", "") for key in all_area_keys if research[key].get("matching_rationale")])),
            "confidence": "; ".join(dict.fromkeys(confidence)),
            "duplicate_of_source_csv_row": "; ".join(map(str, duplicate_rows)),
            "research_source": "; ".join(dict.fromkeys(url for url in sources if url)),
            "human_review_required": "Yes" if human_review or status in {"reviewed_unselected", "unmatched", "unmatched_invalid_coordinate"} else "No",
        })
    return output, audit


def write_audit(records: list[dict]) -> None:
    fields = [
        "source_csv_row", "site_name", "swmd_barangay", "purok", "schedule", "latitude", "longitude",
        "coordinate_status", "v4_status", "selected_schedule_area", "candidate_schedule_area",
        "distance_to_area_reference_km", "matching_rationale", "confidence", "duplicate_of_source_csv_row",
        "research_source", "human_review_required",
    ]
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)


def validate_outputs(v3: list[dict], output: list[dict], audit: list[dict], by_id: dict[int, dict], research: dict[str, dict]) -> None:
    if len(audit) != 670:
        raise ValueError(f"Expected 670 SWMD audit rows, got {len(audit)}")
    audit_source_ids = [int(row["source_csv_row"]) for row in audit]
    if len(set(audit_source_ids)) != 670 or set(audit_source_ids) != set(range(2, 672)):
        raise ValueError("The SWMD audit must account for every source row exactly once")
    missing_selected_audit = [
        source_id
        for source_id in by_id
        if any(source_id in parse_row_ids(decision.get("selected_source_rows", "")) for decision in research.values())
        and not next(row for row in audit if int(row["source_csv_row"]) == source_id).get("selected_schedule_area", "").strip()
    ]
    if missing_selected_audit:
        raise ValueError(f"Selected SWMD rows are missing an area assignment in the audit: {missing_selected_audit[:10]}")
    original_names = {
        area_key(area.get("area_name", ""))
        for driver in v3 for day in driver.get("schedule", []) for area in day.get("area", [])
    }
    output_names = {
        area_key(area.get("area_name", ""))
        for driver in output for day in driver.get("schedule", []) for area in day.get("area", [])
    }
    if original_names != output_names:
        raise ValueError("The v4 area-name set differs from the v3 area-name set")
    for driver in output:
        for day in driver.get("schedule", []):
            for area in day.get("area", []):
                if area_key(area.get("area_name", "")) not in research:
                    raise ValueError(f"No research row for {area.get('area_name')!r}")
                for site in area.get("sites", []):
                    if site.get("latitude") is None or site.get("longitude") is None:
                        if site.get("site_name") not in {"", "firingline"}:
                            raise ValueError("Fallback marker has an unexpected site name")
                    else:
                        source_id_matches = [
                            row for row in by_id.values()
                            if row["coordinates_valid"]
                            and row["site_name"] == site.get("site_name")
                            and round(row["latitude"], 6) == round(float(site["latitude"]), 6)
                            and round(row["longitude"], 6) == round(float(site["longitude"]), 6)
                            and row["barangay"] == area.get("barangay")
                        ]
                        if not source_id_matches:
                            raise ValueError(f"Confirmed JSON site does not match its barangay/source CSV: {area}, {site}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", action="store_true", help="Create the initial v4 research checklist from v3 candidates")
    args = parser.parse_args()

    v3 = json.loads(V3_PATH.read_text(encoding="utf-8-sig"))
    swmd_rows, by_id = load_swmd()
    lookup_by_row = load_lookup_by_row()
    if args.seed:
        if CHECKLIST_PATH.exists():
            raise FileExistsError(f"Refusing to overwrite reviewed checklist: {CHECKLIST_PATH}")
        seed = seed_checklist(v3, swmd_rows, by_id)
        write_checklist(CHECKLIST_PATH, seed)
        print(f"Created a review seed for {len(seed)} distinct schedule areas: {CHECKLIST_PATH}")
        print("Review every row before running the v4 build.")
        return

    if not CHECKLIST_PATH.exists():
        raise FileNotFoundError(f"Missing reviewed checklist: {CHECKLIST_PATH}. Run with --seed first, then review it.")
    research = read_checklist(CHECKLIST_PATH)
    output, audit = build_v4(v3, swmd_rows, by_id, lookup_by_row, research)
    validate_outputs(v3, output, audit, by_id, research)
    cleaned_day_areas = load_cleaned_day_areas()
    validate_cleaned_day_areas(output, cleaned_day_areas)
    serialized_output = json.dumps(output, indent=2, ensure_ascii=False) + "\n"
    V4_PATH.write_text(serialized_output, encoding="utf-8")
    DEMO_V4_PATH.write_text(serialized_output, encoding="utf-8")
    write_demo_area_labels(cleaned_day_areas)
    write_audit(audit)
    matched = sum(row["v4_status"] in {"matched", "duplicate_of_selected_row"} for row in audit)
    unmatched = len(audit) - matched
    needs_review = sum(row.get("fully_checked", "No").lower() != "yes" for row in research.values())
    print(f"Wrote {V4_PATH}")
    print(f"Wrote {DEMO_V4_PATH}")
    print(f"Wrote {AUDIT_PATH}: {len(audit)} source rows ({matched} matched or duplicate-linked; {unmatched} unassigned/invalid)")
    print(f"Research checklist: {len(research)} distinct area labels; {needs_review} still need review")


if __name__ == "__main__":
    # The seed path needs lookup rows while building provenance fields.
    _LOOKUP_CACHE = load_lookup_by_row()

    def load_lookup(source_id: int) -> dict:
        return _LOOKUP_CACHE.get(source_id, {})

    main()
