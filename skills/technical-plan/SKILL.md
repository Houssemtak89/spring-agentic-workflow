---
name: technical-plan
description: Step 3 of the Spring agentic workflow. Builds the technical plan with the developer, one decision at a time, from the project's ADRs, knowledge base and technical files, including whether this ticket is done test-first. Writes 03-technical-plan.md, adds an ADR when a decision deserves one, and stops until /approve technical. Use only when the active ticket is at step 3.
---

# Step 3 · Interactive technical plan (human gate)

Goal: agree on how to build the agreed behaviour (`F1`, `F2`… in `02-functional-questions.md`) with the developer, not for them.

## Read first
Ask the `architect` agent. Give it the ticket folder. It reads the ADRs, the project's knowledge base, the technical files and the code areas listed in `01-understanding.md`, and returns:
- what is already settled, with its source;
- the decisions this ticket really needs, each with options, constraints and a recommendation;
- its view on test-first for this ticket;
- the test level for each rule, the ADR candidates and the risks.

It cannot write. You write the plan.

## One decision at a time
For each decision, in order of impact:
1. State the decision in one sentence.
2. Give two or three options with their cost: complexity, performance, testability, consistency with the existing code.
3. Say what already constrains it: an ADR, a project knowledge entry, an existing pattern. A written project decision wins unless the developer wants to change it.
4. Give your recommendation and why.
5. Stop and wait for the developer's choice before the next decision.

Do not ask about what is already settled: list it, with its source, so the developer can object.

## Test-first or not: ask every time
This is always one of the decisions, never a default. Put it to the developer in two lines: what test-first would bring on this ticket, what it would cost, and what you would pick.
- **Test-first**: the test engineer writes the failing tests for each rule before the code; the developer agents make them pass.
- **Tests alongside**: tests and code are written in parallel against the same contracts.

Record the choice in the plan. The `implement` step follows it.

## New ADR
When a choice is structural, will apply beyond this ticket, or goes against an existing ADR, write a new ADR from `${CLAUDE_SKILL_DIR}/../../templates/adr-template.md` in `docs/adr/`, with status "Proposed". The developer's approval of the plan makes it "Accepted".

## Output: `docs/tickets/<ID>/03-technical-plan.md`

```markdown
# <ID> · Technical plan

## Already settled
- <choice> — <ADR / project knowledge / existing pattern>

## Decisions
| # | Decision | Choice | Why | ADR |
|---|---|---|---|---|

## Test strategy
Test-first: yes | no — the developer's reason.

## Tests by rule
| Rule | Test level | Test class |
|---|---|---|
| F1 | unit | `...Test` |

## Changes by layer
- Domain: ...
- Application: ...
- Adapters (web, persistence, messaging): ...
- Database migration: ...
- Front-end: ...

## Reviews this ticket needs
security | performance | data-protection, each with the reason. Conventions and the functional review always run.

## Risks
```

Every rule `F1`, `F2`… must appear in "Tests by rule".

## Gate
Show a short summary and stop. The developer closes the step with `/approve technical`. Then go to `orchestrate`.
