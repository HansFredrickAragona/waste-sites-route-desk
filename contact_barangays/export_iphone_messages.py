"""Validate a finalized CSV and export a batch for iPhone Shortcuts."""

import argparse
import csv
import json
import re
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    messages = []
    seen = set()
    errors = []
    with args.csv_file.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not {"mobile", "message"}.issubset(reader.fieldnames or []):
            parser.error("CSV must have mobile and message columns.")
        for index, row in enumerate(reader, start=1):
            mobile = re.sub(r"[\s()-]", "", row["mobile"] or "")
            match = re.fullmatch(r"(?:\+?63|0)?(9[0-9]{9})", mobile)
            message = row["message"] or ""
            if not match or not message.strip():
                errors.append(f"Record {index} needs a valid mobile number and message.")
                continue
            number = "+63" + match[1]
            if number in seen:
                errors.append(f"Record {index} repeats a mobile number.")
                continue
            seen.add(number)
            messages.append({"mobile": number, "message": message})

    if errors:
        parser.error("\n".join(errors))
    if not messages:
        parser.error("No messages found.")
    if args.dry_run:
        print(f"Validated {len(messages)} messages.")
        return
    with args.output.open("x", encoding="utf-8") as output:
        json.dump({"messages": messages}, output, ensure_ascii=False, indent=2)
    print(f"Exported {len(messages)} messages.")


if __name__ == "__main__":
    main()
