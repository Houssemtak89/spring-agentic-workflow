---
name: technical-plan
description: Step 3 of the Spring agentic workflow. Builds the technical plan with the developer, one decision at a time, from the project's ADRs and technical files. Writes 03-technical-plan.md, adds an ADR when a decision deserves one, and stops until /approve technical.
---

# Step 3 · Interactive technical plan (human gate)

Goal: agree on how to build the agreed behaviour (`F1`, `F2`… in `02-functional-questions.md`) with the developer, not for them.

## Read first
Ask the `software-architect` agent to read:
- every ADR in `docs/adr/`;
- the project's technical files: build file (`pom.xml` or `build.gradle`), `application*.yml`, conventions, existing ArchUnit rules, CI configuration;
- the code areas listed in `01-understanding.md`.

It returns the list of technical decisions this ticket needs, and for each one the options, what the ADRs already impose, and its recommendation.

## One decision at a time
For each decision, in order of impact:
1. State the decision in one sentence.
2. Give two or three options with their cost: complexity, performance, testability, consistency with the existing code.
3. Say which ADR already decides it, if any. An ADR wins unless the developer wants to change it.
4. Give your recommendation and why.
5. Stop and wait for the developer's choice before the next decision.

Typical decisions: where the rule lives (domain, application service, database constraint), transaction boundaries, concurrency (optimistic lock, unique constraint), API contract changes, data migration (Flyway or Liquibase script), error model, events, caching, security and personal data, test strategy (unit, slice, Testcontainers).

Do not ask about what the conventions already fix (naming, package layout, formatting).

## New ADR
When a choice is structural, will apply beyond this ticket, or goes against an existing ADR, write a new ADR from `templates/adr-template.md` in `docs/adr/`, with status "Proposed". The developer's approval of the plan makes it "Accepted".

## Output: `docs/tickets/<ID>/03-technical-plan.md`

```markdown
# <ID> · Technical plan

## Decisions
| # | Decision | Choice | Why | ADR |
|---|---|---|---|---|

## Changes by layer
- Domain: ...
- Application: ...
- Adapters (web, persistence, messaging): ...
- Database migration: ...
- Front-end: ...

## Tests to write
| Rule | Test level | Test class |
|---|---|---|
| F1 | unit | `...Test` |

## Risks
```

Every rule `F1`, `F2`… must appear in "Tests to write".

## Gate
Show a short summary and stop. The developer closes the step with `/approve technical`. Then set `"step": 4` in `state.json` and go to `orchestrate`.
