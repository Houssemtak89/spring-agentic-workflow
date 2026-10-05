---
name: ticket-status
description: Shows where the active ticket stands in the Spring agentic workflow, its step, the gates approved and what happens next.
disable-model-invocation: true
---

Where the active ticket stands, as the plugin derives it from the approvals and the documents:

!`node "${CLAUDE_SKILL_DIR}/../../hooks/gates.mjs" status`

If no ticket is active, say so and list the folders in `docs/tickets/` with the step written in their `state.json`.

Otherwise read `docs/tickets/<ID>/approvals.json` and answer in a few lines:
- the ticket ID, its size (from `01-understanding.md`), its path (full or fast) and its current step;
- the gates already approved, with their date and note;
- what happens next, and whether it waits for the developer.

Do not change any file.
