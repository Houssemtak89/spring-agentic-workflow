---
name: implement
description: Step 6 of the Spring agentic workflow. Runs the approved implementation plan with specialised agents, in parallel groups, with a shared log where agents leave questions for each other. Use after /approve go.
---

# Step 6 · Implementation by agents

Input: `04-implementation-plan.md`, approved with `/approve go`. Stick to it. If the work shows the plan is wrong, stop and tell the developer instead of improvising: a new decision goes back to step 3.

## Order
1. **Contracts first (T0).** Write the interfaces, DTOs and signatures the other tasks depend on, yourself, in the main session. Compile once (`./mvnw -q -DskipTests compile` or the Gradle equivalent).
2. **One parallel group at a time.** For each group, start all its agents in the same message, so they run at the same time. Give each agent:
   - its task line from the plan: owned files, rules `F…`, what it needs;
   - the paths of `03-technical-plan.md`, the ADRs and the conventions;
   - the path of the shared log, `docs/tickets/<ID>/06-agents-log.md`.
3. **Between groups**: read the log, answer the open questions or route them to the right agent, compile, run the tests of the finished tasks.
4. For a large ticket, stop after each group and give the developer a two-line status. They can say "go on" or stop the work.

## How agents talk to each other
Agents do not share memory. They share the log:

```markdown
## T2 · test-engineer → T1 · hexagonal-developer
Question: should a past slot return 400 or 409?
Answer (T1): 400, see F3.
```

An agent that needs an answer to continue writes its question there, finishes what it can, and says so in its result. You answer from the plan when you can. Otherwise you ask the owner agent in the next group, or the developer if it is a business question.

## Rules for every agent
- Touch only the files the plan gives to its task. A file that belongs to another task is a question for the log, not an edit.
- Follow the ADRs and conventions. No new library, no new pattern, no change of public API that the plan does not list.
- Every rule `F…` of the task gets a test that names it: `@DisplayName("F2: a vet cannot have two appointments on the same slot")`.
- No commented-out code, no TODO left behind, no secrets or personal data in logs.

## Agents of this plugin
`hexagonal-developer`, `test-engineer`, `angular-developer`, `migration-developer` write code.
`performance-reviewer`, `security-reviewer`, `gdpr-reviewer` review the code of the tasks that touch their area, once that code is written. They report findings in the log; the owner agent fixes them.

## End of step
When all groups are done and the code compiles, set `"step": 7` in `state.json` and run the `quality-gates` skill.
