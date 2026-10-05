---
name: approve
description: Developer approval of a gate of the Spring agentic workflow (functional, technical, go, merge, or fast for a small ticket).
argument-hint: "functional | technical | go | merge | fast [note]"
disable-model-invocation: true
---

The developer typed `/approve $ARGUMENTS`.

The plugin's hook checked this approval before this message reached you:
- if it was refused, the developer saw the reason and this message was not sent;
- if it was accepted, the hook recorded it in `approvals.json`, updated `state.json`, and added a line to the context saying so.

Where the ticket stands now:

!`node "${CLAUDE_SKILL_DIR}/../../hooks/gates.mjs" status`

Do not write `approvals.json` or `state.json` yourself.

If the developer added a note, it is an instruction for the next step: take it into account, and keep it for the retro.

Continue the active ticket from the step that follows this gate:
- `functional`: run the `technical-plan` skill.
- `technical`: mark any "Proposed" ADR of this ticket as "Accepted", then run the `orchestrate` skill.
- `go`: run the `implement` skill.
- `fast`: the first three gates are approved together on `02-fast-plan.md`. Run the `implement` skill; it reads its tasks from that document.
- `merge`: give the developer the pull request summary from `08-review.md`, then run the `retro` skill. The ticket closes when the retro is written.
