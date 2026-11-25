---
name: implement
description: Step 6 of the Spring agentic workflow. Runs the approved implementation plan with developer and test-engineer agents in parallel groups, each held to the files its task owns, with per-task notes and focused review lenses on the code written. Use only when the active ticket is at step 6, after /approve go or /approve fast.
---

# Step 6 · Implementation by agents

Input: `04-implementation-plan.md` and `04-tasks.json`, approved with `/approve go`. On the fast path, the tasks are in `02-fast-plan.md`.

Stick to the plan. If the work shows the plan is wrong, stop and tell the developer instead of improvising. On the normal path a new decision goes back to step 3. On the fast path, update `02-fast-plan.md` with the developer's answer; they approve the new version with `/approve fast`.

## Fast path
A small ticket rarely needs parallel agents. Do the code yourself or with one `developer`, and give the tests to the `test-engineer` so that they stay independent from the code. If you use agents, write `04-tasks.json` from the plan's Tasks table first, so that each agent is held to its files; with no task table, the gates alone apply.

Test-first on the fast path: write the signatures the tests need (an empty method, a new type) yourself before the `test-engineer` starts, so that the tests fail on an assertion and not on a compilation error. Then go to the quality gates.

## Order, on the normal path
1. **Contracts first (T0).** Write the interfaces, DTOs and signatures the other tasks depend on, yourself. Compile once (`./mvnw -q -DskipTests compile` or the Gradle equivalent).
2. **One group at a time.** For each group, start all its agents in the same message, so they run at the same time. Give each agent:
   - its task line from the plan: ID, owned files, rules `F…`, what it needs;
   - whether the ticket is test-first;
   - the paths of `03-technical-plan.md`, the ADRs that apply and the conventions;
   - the path of its notes file: `docs/tickets/<ID>/06-log/<task>.md`.
3. **Between groups**: read the notes in `06-log/`, answer the open questions or route them to the right agent, compile, run the tests of the finished tasks.
4. **Review what was written.** For the tasks the plan marks for a lens (security, performance, data-protection), run the `review-lenses` skill on their files. Each finding goes back to the agent that owns the file. Run the lens again on what changed.
5. For a large ticket, stop after each group and give the developer a two-line status. They can say "go on" or stop the work.

## Test-first tickets
When the plan says test-first:
1. the `test-engineer` tasks run first and return tests that **fail for the right reason**; read the failure messages they report;
2. the `developer` tasks then make them pass, without touching the tests;
3. a test the developer agent believes is wrong is a question in its notes: you decide with the rule `F…` in hand, or you ask the developer.

## How agents talk to each other
Agents do not share memory. Each one writes its own notes file, so two agents never write the same file:

```markdown
# T2 · test-engineer

## Question for T1
Should a past slot return 400 or 409?

## Answer (main session, from F3)
400.
```

An agent that needs an answer to continue writes its question, finishes what it can, and says so in its result. You answer from the plan when you can. Otherwise you ask the owner agent in the next group, or the developer if it is a business question.

## What the plugin enforces
You do not need to police these, but you need to know them when an agent reports a refusal:
- a `developer` or `test-engineer` can write only the files its tasks own in `04-tasks.json`, plus its notes;
- agents change files with Edit or Write, not from the shell, and do not commit;
- reviewers write only their findings.

A refusal is a signal that the plan is missing something: a file with no owner, or a task that needs a file owned by another. Fix the plan (`04-implementation-plan.md` and `04-tasks.json` together), do not work around the refusal.

## Rules for every agent
- Follow the ADRs, the project's knowledge base and the conventions. No new library, no new pattern, no change of public API that the plan does not list.
- Every rule `F…` of the task gets a test that names it: `@DisplayName("F2: a vet cannot have two appointments on the same slot")`.
- No commented-out code, no TODO left behind, no secrets or personal data in logs.

## End of step
When all groups are done, the code compiles and the review findings marked "must fix" are fixed, run the `quality-gates` skill.
