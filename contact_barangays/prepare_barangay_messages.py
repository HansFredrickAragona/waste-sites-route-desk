"""Generate a review CSV for the WasteConnect outreach batch.

One output row is written per contact number. A source row with two phone
numbers (separated by / , ; or whitespace) produces two output rows — one
per number — so both can be texted. Numbers starting with 0 are normalized
to +63.
"""

import argparse
import csv
import re
from pathlib import Path

SOURCE = (
    Path(__file__).resolve().parents[1]
    / "data/csvs/raw/Updated_Punong_Barangays_Contact_Info.csv"
)

MESSAGE = """Good day po, {name}! I’m Hans from the Baguio City Mayor’s Office. Kami po ang team na humahawak ng WasteConnect project, and we’re currently mapping waste collection sites across Baguio City.

Makiki-coordinate po sana kami with Barangay {barangay} to confirm the exact locations and schedules of your designated collection points. May I ask po kung anong day and time kayo or the barangay official in charge of waste collection would be available for a short Zoom meeting? Ipapakita po namin ang map during the call para sabay nating ma-review ang mga locations.

I’ve attached the project advisory for your reference. Maraming salamat po!"""


def split_contacts(contact):
    """Split a contact field into individual number strings."""
    if not contact:
        return []
    parts = re.split(r"\s*[,/;]\s*", contact.strip())
    return [p for p in parts if p]


def normalize_number(raw):
    """Return a +63-normalized Philippine mobile number, or None if invalid."""
    compact = re.sub(r"[\s()\-]", "", raw)
    if not compact:
        return None
    if compact.startswith("+63"):
        num = compact[3:]
    elif compact.startswith("0"):
        num = compact[1:]
    elif compact.startswith("63"):
        num = compact[2:]
    else:
        num = compact
    if re.fullmatch(r"9[0-9]{9}", num):
        return "+63" + num
    return None


def prepare_row(row):
    name = row["Name of Punong Barangay"].strip()
    barangay = row["Barangay Name"].strip()
    contact = row["Official Contact Number of Punong Barangay"].strip()

    raw_numbers = split_contacts(contact)

    base_issues = []
    if not name or not barangay:
        base_issues.append("Missing name or barangay")
    if not contact:
        base_issues.append("Missing contact")

    base = {
        "barangay": barangay,
        "name": name,
        "source_contact": contact,
        "message": MESSAGE.format(name=name, barangay=barangay) if name and barangay else "",
    }

    if not raw_numbers:
        return [{**base, "mobile": "", "contact_review": ", ".join(base_issues) or "Missing contact"}]

    rows = []
    for raw in raw_numbers:
        mobile = normalize_number(raw)
        issues = list(base_issues)
        if not mobile:
            issues.append("Review contact")
        rows.append({**base, "mobile": mobile or "", "contact_review": ", ".join(issues)})

    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Path to a new preview CSV")
    args = parser.parse_args()

    with SOURCE.open(encoding="utf-8-sig", newline="") as source:
        all_rows = []
        for row in csv.DictReader(source):
            all_rows.extend(prepare_row(row))

    with args.output.open("x", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=all_rows[0].keys())
        writer.writeheader()
        writer.writerows(all_rows)

    review_count = sum(bool(row["contact_review"]) for row in all_rows)
    print(f"Wrote {len(all_rows)} preview rows. {review_count} need contact or name review.")


if __name__ == "__main__":
    main()
