# Barangay messaging implementation plan

**Goal:** Enable both messaging actions in Barangay status.
**Architecture:** Reuse the existing selection and composer; adapt roster rows without meeting data. Keep ordinary roster editing unchanged.
**Tech stack:** Existing vanilla JavaScript and Node regression script.
**Spec:** ../specs/2026-11-26-barangay-messaging-design.md

## Constraints and review focus
Preserve CSVs, outreach flags, iPhone payload, meeting reminders and existing roster columns. Check missing contacts, duplicate mobiles, general wording, filter/tab selection reset, and mobile checkbox access.

## Task: shared roster messaging
- [x] Extend email-draft.test.mjs for roster drafts and text payloads; observe failure.
- [x] Update app.js shared selection helpers, roster rendering and context-specific drafts. Apply meeting-only CSS class only in Meetings to preserve the roster's last column.
- [x] Run Node regression, syntax and whitespace checks; inspect the diff.
- [x] Update tracker README, NEXT_STEPS and PROJECT_HANDOFF with verification limits. Leave changes local, without committing.

Verification: Node regression and syntax checks passed. Browser/mobile, clipboard/download and iPhone checks remain pending. No persistence changes, dependencies or commits.
