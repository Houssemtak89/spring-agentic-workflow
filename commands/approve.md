---
description: Developer approval of a gate (functional, technical, go, merge)
argument-hint: functional | technical | go | merge [note]
---

The developer typed `/approve $ARGUMENTS`.

The plugin's hook has already checked this approval before this message reached you:
- if it was refused, the developer saw the reason and this message was not sent;
- if it was accepted, the hook recorded it in `approvals.json` and added a line to the context saying so.

Do not write `approvals.json` yourself.

Now continue the active ticket (`docs/tickets/.active`) from the step that follows this gate:
- `functional`: update `state.json` to step 3 and run the `technical-plan` skill. If the developer added a note, take it into account.
- `technical`: mark any "Proposed" ADR of this ticket as "Accepted", update `state.json` to step 4 and run the `orchestrate` skill.
- `go`: update `state.json` to step 6 and run the `implement` skill.
- `merge`: update `state.json` to `"step": "done"`, empty `docs/tickets/.active`, and give the developer the pull request summary from `08-review.md`.
