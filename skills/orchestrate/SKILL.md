---
name: orchestrate
description: Step 4 of the Spring agentic workflow. Turns the approved technical plan into tasks with clear file ownership, in proportion to the ticket size, groups what can run in parallel, and writes 04-implementation-plan.md plus the machine-readable 04-tasks.json that the plugin uses to hold each agent to its files. Ends at the human gate /approve go (step 5). Use only when the active ticket is at step 4.
---

# Step 4 · Orchestration, then step 5 · go

Goal: turn the approved technical plan into concrete tasks, each given to the right agent, with as much parallel work as the dependencies allow. You do this yourself, in this conversation: you already hold the plan.

## The agents
| Agent | Does | Writes |
|---|---|---|
| `developer` | one task of code: domain, application, adapters, migration, front-end | only the files its task owns |
| `test-engineer` | the tests of the rules `F…`, independently from the code | only the test files its task owns |
| `technical-reviewer` | one review lens: security, performance, data-protection, conventions, review-kb | only its findings |
| `functional-reviewer` | rules against behaviour and tests, functional documentation | only documentation |

Also list the agents and skills of the project itself (`.claude/agents/`, `.claude/skills/`): use one when its description fits a task better.

## Size decides the depth
- small: one `developer` and the `test-engineer`. No review lens beyond conventions, unless the plan names a risk.
- medium: `developer` tasks by layer, the `test-engineer`, and the lenses the plan's "Reviews this ticket needs" calls for.
- large: the same, plus a checkpoint after each group of tasks where the developer can stop the work.

## Split into tasks
1. **Contracts first (T0).** The interfaces, DTOs, method signatures and the migration script name that other tasks depend on. The main session writes them before the parallel groups, so agents can work against them.
2. **One task, one agent, its own files.** For each task: the agent, the files it owns, what it needs from another task, the rules `F…` it serves. Two tasks never own the same file, even in different groups: a file has one owner for the whole ticket.
3. **Every rule gets a test task.** Each `F` of "Tests by rule" is served by a `test-engineer` task.
4. **Groups.** Tasks that can run at the same time share a group. A task that needs another task's output goes in a later group.
5. **Test-first ticket**: the test tasks form the first group after T0, the code tasks the next one. Otherwise tests and code share a group.

Ownership is written as paths or globs relative to the project root: `src/main/java/app/domain/**`, `src/test/java/app/SlotTest.java`. Be precise: the plugin refuses any write by a `developer` or `test-engineer` outside what its tasks own.

## Output 1: `docs/tickets/<ID>/04-implementation-plan.md`

```markdown
# <ID> · Implementation plan

Size: medium. Test-first: no.
Agents: developer ×2, test-engineer. Lenses: data-protection, conventions.

## Contracts written first (T0, main session)
- `AppointmentRepository.existsForVetAndSlot(...)`

## Tasks
| # | Agent | Owns | Needs | Rules | Group |
|---|---|---|---|---|---|
| T1 | developer | `src/main/java/app/domain/**` | T0 | F1, F2 | A |
| T2 | test-engineer | `src/test/java/app/**` | T0 | F1-F3 | A |

## Reviews
| Lens | On | When |
|---|---|---|
| data-protection | T1 | after group A |
| conventions | whole diff | step 7 |

## Checks before review
Build and tests, coverage threshold, Sonar quality gate if enabled.
```

## Output 2: `docs/tickets/<ID>/04-tasks.json`
The same tasks, for the plugin. Keep it in line with the table above.

```json
{
  "tasks": [
    { "id": "T1", "agent": "developer", "owns": ["src/main/java/app/domain/**"], "needs": ["T0"], "rules": ["F1", "F2"], "group": "A" },
    { "id": "T2", "agent": "test-engineer", "owns": ["src/test/java/app/**"], "needs": ["T0"], "rules": ["F1", "F2", "F3"], "group": "A" }
  ]
}
```

T0 is not listed: the main session writes the contracts and is not held to a task.

## Step 5 · Gate
Present the plan in a few lines: agents, number of tasks, what runs in parallel, the reviews. Then stop.

Until the developer types `/approve go`, the plugin's hook blocks any change outside `docs/`, by tool or by shell. After the approval, start the implementation with the `implement` skill.
