---
name: review-lenses
description: Reviews a diff or a set of files of a Java / Spring project through one or more lenses, each run by a separate read-only reviewer agent, security, performance, data protection (GDPR), conventions and architecture, or the team's past review comments. Use when asked to review Spring code for one of these concerns, and from the implement, quality-gates and final-review steps of the Spring agentic workflow.
argument-hint: "[security|performance|data-protection|conventions|review-kb ...] [files or git range]"
---

# Review lenses

A lens is one question asked of the code. One `technical-reviewer` agent looks through one lens, so each review stays focused and several can run at the same time.

Arguments: $ARGUMENTS

## The lenses
| Lens | File | Use it when the change… |
|---|---|---|
| `security` | `${CLAUDE_SKILL_DIR}/references/security.md` | adds or changes an endpoint, authentication, authorisation, input handling, secrets, a dependency |
| `performance` | `${CLAUDE_SKILL_DIR}/references/performance.md` | adds a query, loops over data, touches a hot endpoint, a transaction boundary or a cache |
| `data-protection` | `${CLAUDE_SKILL_DIR}/references/data-protection.md` | creates, reads, logs, exports or keeps personal data |
| `conventions` | `${CLAUDE_SKILL_DIR}/references/conventions.md` | always, on the whole diff: ADRs, architecture, the project's way of doing things |
| `review-kb` | `${CLAUDE_SKILL_DIR}/references/review-kb.md` | the project has a review knowledge base in `docs/review-kb/` |

## How to run
1. **Choose the lenses.** Use the ones named in the arguments. Otherwise choose from the table by reading what changed. Do not run a lens for a risk the change does not have.
2. **Define the scope.** The files or the git range named in the arguments. Otherwise the ticket's diff: `git diff <base>...HEAD` plus uncommitted changes.
3. **Start one `technical-reviewer` agent per lens, all in the same message**, so they run in parallel. Give each one:
   - the lens name and the absolute path of its lens file from the table;
   - the scope: file list or git range;
   - when a ticket is active, the ticket folder and the paths of `03-technical-plan.md` and `04-implementation-plan.md`.
4. **Collect.** Each reviewer returns a table of findings and, when a ticket is active, writes it to `docs/tickets/<ID>/06-log/review-<lens>.md`.
5. **Check before passing on.** Read each "must fix" yourself at the file and line given. Drop a finding you cannot confirm, and say that you dropped it.
6. **Report.** One merged table, "must fix" first. Inside the workflow, route each finding to the task that owns the file. Outside it, give the table to the developer and fix only what they ask.

Reviewers never edit code. The plugin enforces it.

## Remote reviewers
A project can also ask for a second opinion from a review service hosted elsewhere, reached through an MCP tool: for example a Hugging Face Space that reviews Java code with an open source model. They are optional and opt-in, because the code leaves the machine. When `.claude/spring-agentic-workflow.json` lists `remoteReviewers`, or when the arguments name one, read `${CLAUDE_SKILL_DIR}/references/remote-reviewers.md` and follow it: what may be sent, how to check what comes back, where to write it.

## Severity, the same for every lens
- **must fix**: wrong behaviour, a hole, data at risk, or a break of an ADR or of the approved plan.
- **should fix**: correct today but fragile, costly, or against a written project rule.
- **note**: worth knowing, no action required.

## The project outranks the lens
A lens file is a list of general things to look for. The project's ADRs, conventions and knowledge base (`.claude/skills/project-knowledge/`) say what this team decided. When they disagree, the project wins, and the reviewer does not report it.
