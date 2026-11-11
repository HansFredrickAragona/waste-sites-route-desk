# Barangay Outreach Tracker

Double-click **Start Tracker.bat**, then open <http://127.0.0.1:8765>.
Keep the server window open while using the tracker. Python 3.12 is installed on the project laptop.

- **Meetings** lets you add a meeting, change its date or time, or mark it complete. Add follow-ups as separate meetings.
- Click a meeting row (or focus it and press Enter/Space) to open its barangay in **Barangay status**, with the name searched and matching row highlighted. Edit and status buttons keep their existing actions. Clear the search to see the full roster again.
- **Barangay status** lets you record whether an email was sent or a text reply was received. Search by barangay, email, or Punong Barangay.
- Click **Has meeting**, **Emailed**, or **Replied by text** to flip the flag. Blank outreach values display as **Not recorded** until set. **Has meeting** follows the meeting log until you set a manual override.

Both CSVs live in the ignored **data/** folder. Back up both files together. Close them in Excel before saving from the tracker. The roster contains two rows with a missing or numeric barangay name. They are flagged for review in the roster and omitted from the meeting picker.

Click **Export CSV** to copy both working files to a new Manila-time folder under **output/**. These snapshots are ignored by Git because they contain contact and outreach data.

Click **Import CSV** to load one or both files from a current tracker export, including renamed exports. Confirming replaces the selected tables. The tracker validates the file columns and meeting references, then backs up the current pair under **output/** before applying the import.

On a fresh copy, run `python server.py --checklist "C:/path/to/Barangay Outreach Checklist.csv"` on first launch to seed past meetings and emails. Later launches keep the saved CSVs. The contact roster comes from the repository source CSV.

Run `python check_tracker.py` to verify persistence and separate follow-up rows.
