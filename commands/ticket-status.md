---
description: Show where the active ticket stands in the Spring agentic workflow
---

Read `docs/tickets/.active`. If it is empty or missing, say that no ticket is active and list the folders in `docs/tickets/` with their `state.json` step.

Otherwise read `docs/tickets/<ID>/state.json` and `approvals.json`, and answer in a few lines:
- the ticket ID, its size and its current step;
- the gates already approved, with their date and note;
- what happens next, and whether it waits for the developer.

Do not change any file.
