# Barangay personalized text template

Direct owner request: edit one script for all messages in Review barangay texts using `<Barangay>`, initially asking for online meeting availability to confirm collection sites/staging areas.

Implementation: a dialog-local template and explicit Apply template to all button in personalized mode. Replace every exact `<Barangay>` token with selected names grouped per normalized mobile. Keep individual message edits until Apply; reject blank templates without losing those edits. Common mode stays literal and Meetings remains unchanged. No dependencies, storage changes or sending.

Verified with the existing Node regression: substitutions, shared mobiles/names, Apply, individual edit retention, blank rejection and personalized JSON. Browser verification remains pending.
