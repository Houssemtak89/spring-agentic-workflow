---
name: fast-plan
description: Fast path of the Spring agentic workflow for a small ticket. Writes one short document, 02-fast-plan.md, that holds the business rules, the technical choices and the tasks, then stops until the developer types /approve fast. Use only when the active ticket is at step 2, its size is small, and the developer chose the fast path.
---

# Fast path · one plan, one approval

For a small ticket, three documents and three approvals cost more than the change. The fast path keeps the same content in one page and one gate. Everything after it is unchanged: implementation, quality gates, reviews, `/approve merge`, retro.

Only the developer chooses the fast path. If, while writing this plan, the ticket turns out not to be small (a new table, several modules, security or personal data, a decision that deserves an ADR), say so and go back to the normal path with `functional-questions`.

## Write `docs/tickets/<ID>/02-fast-plan.md`

```markdown
# <ID> · Fast plan

## Agreed behaviour
The rules as they will be tested, one per line.
- F1: ...
- F2: ...

## Open points
| # | Question | Proposed answer |
|---|---|---|
Only what `01-understanding.md` left open. Each with the answer you would pick.

## Technical choices
- Where the change goes: `path/File.java` ...
- What it reuses from the project: ...
- Anything that is a real choice, with the option taken and why. One or two lines each.
- Test-first for this ticket: yes | no (the developer decides).

## Tests by rule
| Rule | Level | Test class |
|---|---|---|

## Tasks
| # | Who | Files | Rules |
|---|---|---|---|
| T1 | main session or `developer` | `...` | F1, F2 |
| T2 | `test-engineer` | `...Test.java` | F1, F2 |

## Checks
Build and tests, coverage threshold, conventions review, functional review.
```

Keep it to one page. Read the project's knowledge base (`.claude/skills/project-knowledge/`) before the technical choices: a small ticket is where a known project rule is most easily forgotten.

## Ask, then wait
Show the open points and the test-first question in the conversation. When the developer answers, update the file with their words.

Then stop. Until the developer types `/approve fast`, the plugin blocks every change outside `docs/`. That single approval stands for the functional, technical and go gates.
