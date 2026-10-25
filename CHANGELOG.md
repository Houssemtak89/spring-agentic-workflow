# Changelog

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
