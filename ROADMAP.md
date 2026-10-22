# Baguio collection data tool roadmap

## Product direction

Build this app as a personal field data collection tool for documenting Baguio collection sites while visiting them. A quick capture should use the device's current location for the pin and coordinates. The user then records the site name, purok, pickup and drop-off dates and times, and any other useful details.

The Barangay Sites demo is the foundation for this workflow. It already organizes records by barangay, keeps edits in the browser, and exports review data. A captured coordinate can be checked on the map and saved with a Google Maps link; the user supplies the purok and schedule details.

## Product principles

- Make a new site quick to record on a phone while standing at the location.
- Capture GPS coordinates directly and show the reported accuracy so the user can check the pin before saving.
- Keep purok and schedule fields easy to enter, with saved puroks offered as suggestions.
- Preserve local work and make the collected data portable through export.
- Keep location and schedule information editable; never invent missing details.

## Roadmap

### 1. Fast field capture — current

**Implemented in the prototype:**

- Add a pin from the device's current GPS location or place one manually on the map.
- Show the GPS pin on the map and save latitude, longitude, reported accuracy, capture time, and a Google Maps link.
- Recenter the map on a fresh GPS fix; return to the selected pin, or show all mapped pins when none is selected, with a separate floating control.
- Enter a site name, purok, pickup date/day/time, drop-off date/day/time, status, remarks, and notes.
- Keep map placement and coordinate entry available when GPS is denied or unavailable.

**Next:** try the capture form on the phone and tune the layout and field order. Browser GPS access requires HTTPS or localhost and the user's permission.

**Outcome:** a site can be captured in the field, checked on the map, and saved with its useful details in one short flow.

### 2. Organize the personal site record

- Make saved pins easy to search and edit by site name and purok.
- Help spot incomplete records and possible duplicate captures.
- Keep dates, schedules, coordinates, and notes visible in the site details.
- Continue saving work in the browser and make export/import reliable for backup and moving data between devices.

**Outcome:** the collected site list stays usable and recoverable as it grows.

### 3. Review and clean collected data

- Add useful filters for purok, schedule, status, and records that need follow-up.
- Support correcting coordinates, schedules, and site details from the map or record list.
- Preserve a clear activity history so edits can be traced during cleanup.

**Outcome:** the personal dataset can be checked and corrected before it is used elsewhere.

### 4. Add sharing or operational connections when needed

- Use stable site identifiers and a documented export format.
- Connect reviewed sites to schedule planning or the BWMS screens only when the data and workflow are ready.
- Keep this useful as a personal collection tool even if no shared service is introduced.

**Outcome:** collected data can support future scheduling or city workflows without blocking everyday personal use.

## Ordering

Prioritize phone-friendly GPS capture and the purok and schedule form first. Improve record organization and data cleanup next. Sharing, shared storage, and connections to the separate BWMS clone are later options, not prerequisites for the personal tool. This roadmap has no delivery dates.
