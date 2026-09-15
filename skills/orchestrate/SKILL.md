---
name: orchestrate
description: Step 4 of the Spring agentic workflow. Picks the specialised agents and skills a ticket really needs, in proportion to its size, splits the work into tasks that can run in parallel, and writes 04-implementation-plan.md. Ends at the human gate /approve go (step 5).
---

# Step 4 · Orchestration, then step 5 · go

Goal: turn the approved technical plan into concrete tasks, each given to the right agent, with as much parallel work as the dependencies allow.

## List what is available
Delegate to the `orchestrator` agent. It lists the agents and skills it can use: those of this plugin (`agents/`) and those of the project (`.claude/agents/`, `.claude/skills/`). It keeps only what the plan needs.

| Agent | Use it when |
|---|---|
| `hexagonal-developer` | domain or application code, ports and adapters |
| `test-engineer` | unit, slice and Testcontainers tests for the `F` rules |
| `angular-developer` | the ticket changes the front-end |
| `performance-reviewer` | new queries, loops on data, hot endpoints, caching |
| `security-reviewer` | authentication, authorisation, input validation, secrets |
| `gdpr-reviewer` | personal data is created, read, logged, exported or kept |
| `migration-developer` | schema or data migration |

## Size decides the depth
- small: one developer agent and the test engineer. No reviewer agent unless the plan names a risk.
- medium: developer agents by layer, the test engineer, and the reviewers the risks call for.
- large: the same, plus a checkpoint after each group of tasks where the developer can stop the work.

## Split into tasks
For each task: the agent, the files it owns, what it needs from another task, and the rules (`F1`…) it serves. Two tasks running at the same time never own the same file.

Write the contracts first (port interfaces, DTOs, API signatures) so agents can work in parallel against them.

## Output: `docs/tickets/<ID>/04-implementation-plan.md`

```markdown
# <ID> · Implementation plan

Size: medium. Agents: hexagonal-developer, test-engineer, gdpr-reviewer.

## Contracts written first
- `AppointmentRepository.existsForVetAndSlot(...)`

## Tasks
| # | Agent | Owns | Needs | Rules | Parallel group |
|---|---|---|---|---|---|
| T1 | hexagonal-developer | `domain/...` | contracts | F1, F2 | A |
| T2 | test-engineer | `src/test/...` | contracts | F1-F3 | A |

## Checks before review
JaCoCo threshold, Sonar quality gate, quality guardian.
```

## Step 5 · Gate
Present the plan in a few lines: agents, number of tasks, what runs in parallel, the estimated size. Then stop.

Until the developer types `/approve go`, the plugin's hook blocks any change outside `docs/`. After the approval, set `"step": 6` in `state.json` and start the implementation.
