"""Refresh the weekday site summary from the current v4 schedule."""

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCHEDULE = ROOT / "data/jsons/schedules/driver_schedule_v4.json"
OUTPUT = ROOT / "data/csvs/summaries/weekday_unique_site_counts_v4.csv"
DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


def main():
    schedule = json.loads(SCHEDULE.read_text(encoding="utf-8"))
    locations = defaultdict(Counter)
    excluded = Counter()
    food_waste_entries = Counter()

    for driver in schedule:
        for entry in driver["schedule"]:
            day = entry["day"]
            if day not in DAYS:
                continue
            area = entry["area"]
            details = area if isinstance(area, list) else area["details"]
            area_name = area.get("name", "") if isinstance(area, dict) else ", ".join(
                detail.get("area_name", "") for detail in details
            )
            if "food waste collection" in area_name.lower():
                food_waste_entries[day] += 1
            for detail in details:
                for site in detail["sites"]:
                    latitude, longitude = site.get("latitude"), site.get("longitude")
                    if latitude is None or longitude is None:
                        excluded[day] += 1
                        continue
                    locations[day][(round(latitude, 6), round(longitude, 6))] += 1

    unique = {day: len(locations[day]) for day in DAYS}
    twice = {day: sum(count == 2 for count in locations[day].values()) for day in DAYS}
    three_plus = {day: sum(count >= 3 for count in locations[day].values()) for day in DAYS}
    extra = {day: sum(count - 1 for count in locations[day].values()) for day in DAYS}

    def row(metric, values):
        return [metric, *(values[day] for day in DAYS)]

    rows = [
        row("Total unique mapped sites scheduled", unique),
        row("Unique sites listed exactly twice", twice),
        row("Unique sites listed 3 or more times", three_plus),
        row("Extra site listings removed by deduplication", extra),
        row("Residual sites (inferred; non-food-waste routes)", unique),
        row("Mapped food-waste sites", {day: 0 for day in DAYS}),
        row("Food-waste schedule entries without coordinates", food_waste_entries),
        row("Site entries excluded for missing coordinates", excluded),
        row(
            "Remarks",
            {
                day: (
                    f"{twice[day]} of {unique[day]} unique mapped sites are listed exactly twice; "
                    f"{three_plus[day]} are listed 3 or more times. "
                    f"{food_waste_entries[day]} food-waste schedule entry/entries have no mapped sites; "
                    f"{excluded[day]} site entries have no coordinates."
                )
                for day in DAYS
            },
        ),
        [
            "Method",
            "Sites are deduplicated by coordinate rounded to 6 decimal places. "
            "Counts describe scheduled locations, not completed pickups. "
            "Null-coordinate firingline and blank fallback entries are excluded from mapped-site totals. "
            "Residual classification is inferred from routes not labeled Food Waste; "
            "v4 has no explicit waste-type field.",
            *([""] * (len(DAYS) - 1)),
        ],
    ]
    with OUTPUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Metric", *DAYS])
        writer.writerows(rows)


if __name__ == "__main__":
    main()
