---
name: final-review
description: Step 8 of the Spring agentic workflow. Two AI reviews before the developer's own review. One checks that every agreed business rule is covered by a test. The other checks the change against the team's past review comments. Writes 08-review.md and prepares the pull request for /approve merge.
---

# Step 8 · AI reviews, then step 9 · human review

## 8a · Is every rule covered by a test?
Ask the `requirement-coverage-reviewer` agent. It reads the agreed behaviour in `02-functional-questions.md` (rules `F1`, `F2`…), the planned tests in `03-technical-plan.md`, and the test code. For each rule it finds the test or tests that prove it, and says whether they really check the rule or only run the code.

A rule without a real test sends the ticket back to step 6, to the `test-engineer`.

## 8b · What would the team say?
The team's past review comments are in `docs/review-kb/review-comments.md`. If the file is missing or older than a month, rebuild it with the script of this skill. It needs the GitHub CLI, logged in:

```bash
node "${CLAUDE_SKILL_DIR}/build-review-kb.mjs"
```

Then ask the `review-kb-reviewer` agent to read the diff against this base. It reports each place where the new code repeats something the team already asked to change, with the past comment it relies on.

Fix what is clear through the owner agent, then run the quality gates again.

## Output: `docs/tickets/<ID>/08-review.md`

```markdown
# <ID> · Review

## Rules and tests
| Rule | Test | Verdict |
|---|---|---|
| F1 | `AppointmentServiceTest.refusesSecondAppointmentOnSameSlot` | covered |

## Remarks from the team's past reviews
| Where | Remark | Past comment | Done |
|---|---|---|---|

## For the human reviewer
What to look at first, the choices made and their ADR, what was left out on purpose.

## Pull request summary
```

## Step 9 · Human review (gate)
Open or update the pull request with the summary. Include links to the ticket folder, so the reviewer can read the questions, the plan and the reports. Then stop.

The developer reviews the code. If they ask for changes, go back to step 6 with their remarks and run steps 7 and 8 again. When they are satisfied, they type `/approve merge`. The plugin accepts it only if the last quality run is green and no code changed since.
