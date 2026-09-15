---
description: Start or resume a ticket in the Spring agentic workflow
argument-hint: <TICKET-ID> [ticket text or path to a file]
---

Run the Spring agentic workflow for this ticket: $ARGUMENTS

## Start or resume
1. The first word of the arguments is the ticket ID. The rest is the ticket text, or a path to a file that holds it.
2. Write the ID, alone, in `docs/tickets/.active`. This turns the plugin's gates on for this ticket.
3. If `docs/tickets/<ID>/state.json` exists, read it, read `approvals.json` next to it, and resume at the step it says. Tell the developer in one line where the ticket stands.
4. Otherwise create `docs/tickets/<ID>/`, save the ticket text in `00-ticket.md`, and write `state.json`:
   ```json
   { "ticket": "<ID>", "step": 1, "size": null }
   ```

## The steps
| Step | Skill | Ends with |
|---|---|---|
| 1 | `understand-requirement` | `01-understanding.md` |
| 2 | `functional-questions` | the developer types `/approve functional` |
| 3 | `technical-plan` | the developer types `/approve technical` |
| 4-5 | `orchestrate` | the developer types `/approve go` |
| 6 | `implement` | code and tests, `06-agents-log.md` |
| 7 | `quality-gates` | `07-quality-report.md`, all green |
| 8 | `final-review` | `08-review.md` |
| 9 | developer review | the developer types `/approve merge` |

## Rules
- Never skip a gate, never approve on the developer's behalf, never edit `approvals.json`. The plugin's hooks refuse it anyway.
- At a gate, stop and wait. Say what you need from the developer in one or two sentences.
- Keep the depth in proportion to the ticket size written in `state.json`.
- Each step writes its file in `docs/tickets/<ID>/` so the reasoning can be read later in the pull request.
