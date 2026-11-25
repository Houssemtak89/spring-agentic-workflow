# Changelog

## 0.3.1
After a first real call to a remote reviewer (Java Code Reviewer, run locally, on the two classes changed by a test ticket).
- Remote reviewers: findings on lines the ticket did not change are dropped as outside the ticket; a call gets about a minute and one retry.
- The documentation no longer assumes a Hugging Face Space: a remote reviewer is another model outside the session, hosted anywhere, including on the developer's machine.

## 0.3.0
After two full runs of the same ticket on spring-petclinic, one driven by a small model on the normal path and one by a large model on the fast path.

### Remote reviewers
- A project can list review services hosted elsewhere, reached through an MCP tool (for example a Java reviewer running as a Hugging Face Space), in `remoteReviewers`. They are asked for a second opinion at step 8.
- Opt-in, because the changed code leaves the machine: only code the ticket changed is sent, and each finding is checked at its line before it counts.

### Hooks
- The project is found from the file being touched or the folder a command starts in, so the gates hold in a monorepo or when the session is opened in a parent folder.
- The protected files can be read from the shell. Only writing them is refused.
- `08-review.md` is refused until the quality report `07-quality-report.md` exists.
- A document changed after its approval is reported in the ticket status until the developer approves it again. `/approve fast` can be typed again for that.

### Skills and agents
- The analyst lists what the build enforces (a test that keeps files in sync, a formatter, an architecture test) and checks its line references before returning. The fast plan must say how the change satisfies those checks.
- The fast path is always offered for a small ticket, with the open points listed; it writes a task table when agents do the work, so each agent is held to its files.
- The quality-gates skill states its defaults (80% line coverage, Sonar off) and how to give the build its environment.
- The retro has a "Follow-up for a next ticket" section.

## 0.2.1
Found by running the plugin on spring-petclinic.
- Quality gates on Windows: the Maven and Gradle wrappers are called as `.\mvnw.cmd` and `.\gradlew.bat`; the bare name was not found by the shell.
- The gate script can no longer be run from the shell to record an approval in the developer's place. Only its `status` mode is allowed.

## 0.2.0

### Agents: 13 → 6
- `analyst`, `architect`, `developer`, `test-engineer`, `technical-reviewer`, `functional-reviewer`.
- `developer` replaces `hexagonal-developer`, `angular-developer` and `migration-developer`.
- `technical-reviewer` replaces `security-reviewer`, `performance-reviewer`, `gdpr-reviewer`, `quality-guardian` and `review-kb-reviewer`: one instance per review lens.
- `functional-reviewer` replaces `requirement-coverage-reviewer` and also keeps the functional documentation up to date.
- `orchestrator` is removed: the `orchestrate` skill runs in the main session.
- Each agent's write scope is enforced by the hooks, not only stated in its prompt.

### Skills
- New: `engineering-principles` (the only fixed rules), `review-lenses` with five lens files, `retro` (step 10), `fast-plan`, `setup`.
- `ticket`, `approve` and `ticket-status` are now skills; the `commands/` folder is gone. The slash commands keep their names.
- `technical-plan` asks on every ticket whether it is done test-first.
- `orchestrate` also writes `04-tasks.json`, the file ownership table read by the hooks.

### Hooks
- Before `/approve go`, shell commands that write outside `docs/` are refused, not only edits. The PowerShell tool is covered.
- Code changed by a shell command after a quality run is detected through git.
- The active ticket and `state.json` are written by the hooks; the step is derived from the approvals and the documents present. Claude can no longer write them.
- New `/approve fast` for small tickets, and `/ticket --off`.
- New `SessionStart` hook: the active ticket is put back in the context on start, resume and compaction.
- Per-task notes in `06-log/` replace the shared `06-agents-log.md`.

### Changed behaviour
- The Stop hook no longer relies on the step written by Claude. It blocks once the quality gates have run and are red or out of date.
- After `/approve merge` the ticket stays active until `10-retro.md` is written.

### Packaging
- README with a workflow diagram (`docs/workflow.svg`, built by `docs/build-workflow-diagram.mjs`).
- Templates for the settings file and the empty project knowledge base.

## 0.1.0
- First version: nine steps, four gates, thirteen agents.
