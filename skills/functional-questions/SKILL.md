---
name: functional-questions
description: Step 2 of the Spring agentic workflow. Turns the gaps found in step 1 into a short list of business questions for the developer, records the answers in 02-functional-questions.md, and stops until the developer approves with /approve functional.
---

# Step 2 · Functional questions (human gate)

Goal: settle the business behaviour before any technical choice. A wrong assumption here costs the most later.

## Write the questions
Start from the "Gaps and contradictions" section of `01-understanding.md`.

Rules for each question:
- About behaviour, never about implementation ("What happens when the slot is already taken?", not "Should we add a unique index?").
- Closed when possible, with the options you see and the one you would pick, so the developer can answer in a few words.
- Include an example with real values when the rule is about data.
- Ten questions at most. If more come up, the ticket is probably large: say so.

Group them: nominal case, edge cases, errors, data and access rights.

## Ask, then wait
Show the questions in the conversation and write them to `docs/tickets/<ID>/02-functional-questions.md`:

```markdown
# <ID> · Functional questions

| # | Question | Options | Answer |
|---|---|---|---|
| 1 | ... | a) ... b) ... (proposed: a) | |
```

Then stop. Do not plan or code anything.

When the developer answers, fill the Answer column with their words, and add an "Agreed behaviour" section: the rules as they will be tested, one per line, numbered `F1`, `F2`… These numbers are reused by the tests and by the coverage review at step 8.

## Gate
The developer closes this step by typing `/approve functional`. Only the developer can do it: the approval is recorded by a hook, and the plugin refuses any write to `approvals.json`.

If they change an answer later, update the file and ask them to approve again.

Once approved, set `"step": 3` in `state.json` and go to `technical-plan`.
