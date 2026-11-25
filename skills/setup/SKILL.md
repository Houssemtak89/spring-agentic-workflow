---
name: setup
description: Prepares a Java / Spring project for the Spring agentic workflow, checks the prerequisites, creates the settings file, the ticket folder, an empty project knowledge base, and offers the optional templates (conventions, ADR, ArchUnit, JaCoCo, Sonar).
disable-model-invocation: true
---

# Setup

Prepare this project for the workflow. Do the checks, show the developer what you are about to create, and create only what they agree to. Never overwrite an existing file: show the difference and ask.

Templates of the plugin are in `${CLAUDE_SKILL_DIR}/../../templates/`.

## 1. Check
Run these and report each in one line:
- `node --version` — required: the plugin's hooks and scripts run on Node 18 or later;
- `git rev-parse --is-inside-work-tree` — required: the plugin follows code changes through git;
- the build tool: `pom.xml` (with or without `mvnw`) or `build.gradle(.kts)`;
- JaCoCo in the build file — needed for the coverage check of step 7;
- `gh auth status` — optional: only for the review knowledge base of step 8.

## 2. Always create
1. **Settings**: `.claude/spring-agentic-workflow.json`, from `templates/spring-agentic-workflow.json`. Ask the developer for the coverage threshold, whether Sonar is used, and whether the project has a specification folder (`specsPath`).
2. **Ticket folder**: `docs/tickets/` with a `.gitkeep`.
3. **Project knowledge base**: `.claude/skills/project-knowledge/SKILL.md`, from `templates/project-knowledge/SKILL.md`. It starts empty. The retro of each ticket fills it.
4. **`.gitignore`** lines, added with the Edit tool, so that each developer's local state stays local while the documents and approvals are shared:
   ```
   docs/tickets/.active
   docs/tickets/*/state.json
   docs/tickets/*/.dirty
   docs/tickets/*/.snapshot
   ```

## 3. Offer, one by one
| What | From | To | When it is worth it |
|---|---|---|---|
| Conventions file | `templates/conventions.md` | `docs/conventions.md` | the project has none. Adapt it to what the code really does: read a few classes first, and remove every line that is not true here |
| ADR template | `templates/adr-template.md` | `docs/adr/0000-template.md` | the project has no `docs/adr/` |
| ArchUnit test | `templates/archunit/HexagonalArchitectureTest.java` | `src/test/java/<root package>/architecture/` | the project is hexagonal and has no architecture test. Change the packages to match |
| JaCoCo | `templates/jacoco/pom-snippet.xml` | the build file | no JaCoCo report yet |
| Sonar | `templates/sonarcloud/ci.yml` | the CI configuration | the team uses SonarCloud or SonarQube |

**Remote reviewers.** Ask whether the team wants a second opinion from a review service hosted elsewhere (for example a Java reviewer running as a Hugging Face Space, reached through MCP). Explain that the changed code is sent to that service. Only if the developer agrees: they connect its MCP server (`claude mcp add --transport http <name> <url>/mcp`), and you add it to `remoteReviewers` in the settings file. Otherwise leave the list empty.

The conventions file and the knowledge base are different things: conventions are what the team decided up front, the knowledge base is what tickets taught. Both stay short.

## 4. Finish
Tell the developer what was created, what was skipped, and how to start:

```
/spring-agentic-workflow:ticket PET-123 <ticket text or path to a file>
```
