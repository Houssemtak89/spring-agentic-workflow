---
name: ticket
description: Starts or resumes a ticket in the Spring agentic workflow, from analysis to merge, with the developer deciding at each gate.
argument-hint: "<TICKET-ID> [ticket text or path to a file] | --off"
disable-model-invocation: true
---

The developer typed `/ticket $ARGUMENTS`.

The plugin's hook ran before this message reached you. It made the ticket the active one, created `docs/tickets/<ID>/` and wrote `state.json`. Where the ticket stands now:

!`node "${CLAUDE_SKILL_DIR}/../../hooks/gates.mjs" status`

You never write `docs/tickets/.active`, `state.json` or `approvals.json`: the plugin does, and refuses your writes. The step is derived from what the developer approved and from the documents that exist.

## Start or resume
1. The first word of the arguments is the ticket ID. The rest is the ticket text, or a path to a file that holds it.
2. If `docs/tickets/<ID>/00-ticket.md` does not exist, save the ticket text there, as given.
3. Tell the developer in one line where the ticket stands, then carry on from the step above.

## The steps
| Step | Skill | Ends with |
|---|---|---|
| 1 | `understand-requirement` | `01-understanding.md`, with a size |
| 2 | `functional-questions` | the developer types `/approve functional` |
| 3 | `technical-plan` | the developer types `/approve technical` |
| 4-5 | `orchestrate` | the developer types `/approve go` |
| 6 | `implement` | code and tests, notes in `06-log/` |
| 7 | `quality-gates` | `07-quality-report.md`, all green |
| 8 | `final-review` | `08-review.md`, functional documentation up to date |
| 9 | developer review | the developer types `/approve merge` |
| 10 | `retro` | `10-retro.md`, project knowledge enriched |

**Fast path, for a small ticket.** After step 1, if the ticket is small, offer it: the `fast-plan` skill writes one short document (`02-fast-plan.md`) and the developer types `/approve fast`, which stands for the first three gates. Steps 6 to 10 stay. Only the developer can choose it.

## Rules
- Never skip a gate, never approve on the developer's behalf. The plugin's hooks refuse it anyway.
- At a gate, stop and wait. Say what you need from the developer in one or two sentences.
- Keep the depth in proportion to the size written in `01-understanding.md`.
- Each step writes its document in `docs/tickets/<ID>/`, so the reasoning can be read later in the pull request.
- Before any code is read or written, the agents read the project's knowledge base (`.claude/skills/project-knowledge/`) when it exists. It is what the previous tickets taught.
