---
name: quality-gates
description: Step 7 of the Spring agentic workflow. Runs the build and tests, checks JaCoCo coverage and the Sonar quality gate with a script, then runs the conventions review lens on the whole diff. Loops back to the code until everything is green. Use when the active ticket is at step 6 or 7 and the implementation is complete, or after any code change that follows a green run.
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

Sonar needs `SONAR_TOKEN` in the environment and the `sonar.*` properties in the build file (see `templates/sonarcloud` in this plugin).

## 2. The conventions review
When the script passes, run the `review-lenses` skill with the `conventions` lens on the whole diff of the ticket (`git diff` against the branch start, plus uncommitted changes). It checks what tools miss: the technical plan, the ADRs, the project's knowledge base, the layering, one way of doing things, test names that cite the rules `F…`.

## 3. Loop
If the script or the review finds a problem:
- fix it through the agent that owns the file (see `04-implementation-plan.md`), or yourself on the fast path;
- run the script again.

The plugin knows when code changed after the last run, whether through an edit or a shell command. It will not let you hand back to the developer, or let the developer approve the merge, until the last run is green and no code changed since.

After three failed rounds on the same problem, stop and explain it to the developer: what fails, what you tried, what you think the cause is.

## Output: `docs/tickets/<ID>/07-quality-report.md`

```markdown
# <ID> · Quality report

| Check | Result |
|---|---|
| Build and tests | passed, 142 tests |
| Coverage | 84.2% (threshold 80%) |
| Sonar quality gate | passed |
| Conventions review | 2 findings fixed |

## Findings fixed
| Where | Finding | Fix |
|---|---|---|

## What failed along the way
Each check that failed before it passed, and its cause. The retro reads this.
```

Then run `final-review`.
