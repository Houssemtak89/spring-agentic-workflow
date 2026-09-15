---
name: quality-gates
description: Step 7 of the Spring agentic workflow. Runs the build and tests, checks JaCoCo coverage and the Sonar quality gate with a script, then asks the quality-guardian agent to check conventions and architecture. Loops back to the code until everything is green.
---

# Step 7 · Quality gates

## 1. The script
Run the script that comes with this skill, from the project root:

```bash
node "${CLAUDE_SKILL_DIR}/run.mjs"
```

It runs the build with the tests (`./mvnw -B verify` or `./gradlew check jacocoTestReport`), reads the JaCoCo report, and, if the project turns Sonar on, runs the analysis and waits for the quality gate. It writes `docs/tickets/<ID>/07-quality-gates.json`. You never write that file yourself.

Settings go in `.claude/spring-agentic-workflow.json`:

```json
{ "coverageThreshold": 80, "sonar": true }
```

Sonar needs `SONAR_TOKEN` in the environment and the `sonar.*` properties in the build file (see `templates/sonarcloud`).

## 2. The quality guardian
When the script passes, ask the `quality-guardian` agent to review the diff of the ticket (`git diff` against the branch start). It checks what tools miss: the ADRs, the conventions, the layering, naming, error handling, test names that cite the rules `F…`.

## 3. Loop
If the script or the guardian finds a problem:
- fix it through the agent that owns the file (see `04-implementation-plan.md`);
- run the script again.

The plugin knows when code changed after the last run. It will not let you hand back to the developer, or let the developer approve the merge, until the last run is green and no code changed since.

After three failed rounds on the same problem, stop and explain it to the developer.

## Output: `docs/tickets/<ID>/07-quality-report.md`

```markdown
# <ID> · Quality report

| Check | Result |
|---|---|
| Build and tests | passed, 142 tests |
| Coverage | 84.2% (threshold 80%) |
| Sonar quality gate | passed |
| Quality guardian | 2 findings fixed |

## Findings fixed
```

Then set `"step": 8` in `state.json` and run `final-review`.
