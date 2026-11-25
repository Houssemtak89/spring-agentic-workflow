---
name: final-review
description: Step 8 of the Spring agentic workflow. Two AI reviews before the developer's own review. The functional reviewer checks every agreed business rule against the behaviour and its tests, and brings the functional documentation up to date. The technical reviewer checks the change against the team's past review comments. Writes 08-review.md and prepares the pull request for /approve merge. Use only when the active ticket is at step 8, after a green quality run.
---

# Step 8 · AI reviews, then step 9 · human review

Run 8a, 8b and 8c in the same message: they are independent.

## 8a · Functional review and documentation
Ask the `functional-reviewer` agent. Give it:
- the ticket folder;
- the specification folder, if `.claude/spring-agentic-workflow.json` sets `specsPath`. Otherwise it looks for existing functional documentation and, if the project has none, maintains `docs/functional/`.

It does two things:
1. for each rule `F1`, `F2`… it checks that the code implements what was agreed and that a test really proves it (covered, weak, missing);
2. it updates the functional documentation so that it states the rules now in force, in business words.

It writes documentation only. A rule that is weak, missing or implemented differently sends the ticket back to step 6, to the `test-engineer` or the owner of the code.

## 8b · What would the team say?
The team's past review comments are in `docs/review-kb/review-comments.md`. If the file is missing or older than a month, rebuild it with the script of this skill. It needs the GitHub CLI, logged in:

```bash
node "${CLAUDE_SKILL_DIR}/build-review-kb.mjs"
```

If the project has no pull request history or no GitHub CLI, skip 8b and say so in the review.

Then run the `review-lenses` skill with the `review-kb` lens on the diff. It reports each place where the new code repeats something the team already asked to change, with the past comment it relies on.

## 8c · A second opinion from outside (optional)
If `.claude/spring-agentic-workflow.json` lists `remoteReviewers` and their MCP tools are available in this session, ask them, following `${CLAUDE_SKILL_DIR}/../review-lenses/references/remote-reviewers.md`. A remote reviewer is another model hosted elsewhere, so only the code this ticket changed is sent, and each finding it returns is checked at its line before it counts. If none is configured, or the service does not answer, skip this step and say so.

Fix what is clear through the owner of the file (the task that owns it in `04-implementation-plan.md`, or in the Tasks table of `02-fast-plan.md` on the fast path), then run the quality gates again: the plugin requires a green run after any code change.

## Output: `docs/tickets/<ID>/08-review.md`

```markdown
# <ID> · Review

## Rules, behaviour and tests
| Rule | Implemented as agreed | Test | Verdict |
|---|---|---|---|
| F1 | yes | `AppointmentServiceTest.refusesSecondAppointmentOnSameSlot` | covered |

## Functional documentation updated
- `docs/functional/appointments.md`: ...

## Remarks from the team's past reviews
| Where | Remark | Past comment | Done |
|---|---|---|---|

## Remote reviewers
| Reviewer | Sent | Findings confirmed | Dropped after checking | Done |
|---|---|---|---|---|

## For the human reviewer
What to look at first, the choices made and their ADR, what was left out on purpose.

## Pull request summary
```

## Step 9 · Human review (gate)
Prepare the pull request summary, with links to the ticket folder so the reviewer can read the questions, the plan and the reports. Ask the developer before pushing the branch or opening the pull request, unless they already told you to. Then stop.

The developer reviews the code. If they ask for changes, go back to step 6 with their remarks and run steps 7 and 8 again. Keep their remarks: the retro learns from them. When they are satisfied, they type `/approve merge`. The plugin accepts it only if the last quality run is green and no code changed since.
