# Spring agentic workflow

A Claude Code plugin that takes a Java / Spring ticket from analysis to merge. AI agents analyse, plan, implement and review. **You decide at four gates**, the plugin's hooks hold everyone to it, and every ticket teaches the project's own knowledge base.

It runs on Claude Code today and is **built to move to another AI coding tool**: the gate logic and the scripts are plain Node with no dependency, and the workflow, the agent roles and the review lenses are Markdown. See [Portability](#portability).

![The workflow: ten steps, four gates, six agents, and a learning loop](docs/workflow.svg)

## Why this plugin

- **Gates that cannot be talked around.** Approvals are recorded by a hook when *you* type `/approve`. Until you approve the plan, no code can change, whether by an edit or by a shell command. Claude cannot write the approval files.
- **Few agents, real limits.** Six agents, each used where a separate context helps, each held by the hooks to what it may write: reviewers cannot edit code, a developer agent cannot touch a file its task does not own.
- **Every business rule is traced.** Rules agreed with you are numbered `F1`, `F2`… and followed through the plan, the tests, the review and the functional documentation.
- **It learns your project, it does not lecture it.** The plugin ships only common principles (DRY, SOLID, YAGNI, KISS). After each ticket, a retro proposes what the project should remember; what you validate goes into a project skill that every later ticket reads first.
- **Proportionate.** A small ticket takes the fast path: one page, one approval.

## Requirements

- Claude Code, with plugins enabled
- Node.js 18 or later (the hooks and scripts are plain Node, no dependency)
- A git repository with a Maven or Gradle build
- Optional: JaCoCo (coverage check), Sonar (quality gate), GitHub CLI (review knowledge base)

## Install

```
/plugin marketplace add Houssemtak89/spring-agentic-workflow
/plugin install spring-agentic-workflow@spring-agentic-workflow
```

Then, once per project:

```
/spring-agentic-workflow:setup
```

It checks the prerequisites, creates `.claude/spring-agentic-workflow.json`, `docs/tickets/` and an empty knowledge base, and offers the optional templates (conventions, ADR, ArchUnit, JaCoCo, Sonar).

## Five-minute start

```
/spring-agentic-workflow:ticket PET-123 A vet must not have two appointments on the same slot
```

1. Claude reads the code and tells you what the ticket touches and how big it is.
2. It asks you the business questions the ticket left open. You answer, then `/approve functional`.
3. It walks you through the technical decisions, one at a time, including whether this ticket is done test-first. Then `/approve technical`.
4. It shows the tasks, who does what and what runs in parallel. Then `/approve go`.
5. Agents write the code and the tests; checks and reviews run; the functional documentation is updated.
6. You review the pull request, then `/approve merge`.
7. Claude proposes what the project should remember from this ticket. You keep what is right.

## The steps

| Step | Skill | Who works | Ends with |
|---|---|---|---|
| 1 | `understand-requirement` | `analyst` | `01-understanding.md`, with a size |
| 2 | `functional-questions` | main session, you | **`/approve functional`** |
| 3 | `technical-plan` | `architect`, you | **`/approve technical`** |
| 4-5 | `orchestrate` | main session | **`/approve go`** |
| 6 | `implement` | `developer` × N, `test-engineer`, review lenses | code, tests, notes in `06-log/` |
| 7 | `quality-gates` | script, `technical-reviewer` (conventions) | `07-quality-report.md`, all green |
| 8 | `final-review` | `functional-reviewer`, `technical-reviewer` (past reviews) | `08-review.md`, functional docs updated |
| 9 | your review | you | **`/approve merge`** |
| 10 | `retro` | main session, you | `10-retro.md`, knowledge base enriched |

Every step writes its document in `docs/tickets/<ID>/`, so the reasoning can be read later in the pull request.

### Fast path

After step 1, if the ticket is small, Claude offers the fast path. It writes one page, `02-fast-plan.md` (rules, choices, tasks), and you type:

```
/approve fast
```

That single approval stands for the first three gates. Steps 6 to 10 are unchanged. Only you can choose it.

## Commands

| You type | What it does |
|---|---|
| `/ticket <ID> [text or file]` | start or resume a ticket; `/ticket --off` switches the gates off |
| `/approve functional \| technical \| go \| merge [note]` | pass a gate; the note is passed on to the next step |
| `/approve fast [note]` | fast path for a small ticket |
| `/ticket-status` | where the ticket stands and what comes next |
| `/setup` | prepare a project |
| `/review-lenses [lens…] [files or git range]` | run review lenses outside a ticket |

Commands are namespaced by Claude Code: `/spring-agentic-workflow:ticket` always works; the short form works when no other plugin uses the same name.

## The agents

| Agent | Role | May write |
|---|---|---|
| `analyst` | maps the ticket to the code, the ADRs and the project knowledge; every claim cites a file | nothing |
| `architect` | lists the real decisions, with options, cost and what the project already settled | nothing |
| `developer` | implements one task: domain, adapters, migration or front-end; several run in parallel | only the files its task owns |
| `test-engineer` | proves each rule `F…` from the contracts, independently from the code | only its own test files |
| `technical-reviewer` | one review lens per instance, in parallel | only its findings |
| `functional-reviewer` | checks each rule against behaviour and tests, updates the functional documentation | only documentation |

"May write" is not a request in a prompt: the plugin's `PreToolUse` hook reads which agent is calling and refuses the rest.

### Review lenses

One `technical-reviewer` looks through one lens: `security`, `performance`, `data-protection`, `conventions`, `review-kb` (the team's past pull request comments). A lens runs only when the change has that risk. The lens files are in [`skills/review-lenses/references/`](skills/review-lenses/references/); the project's own rules outrank them.

## What the hooks enforce

| When | Rule |
|---|---|
| Always | `approvals.json`, the active ticket and `state.json` are written only by the hooks, when you type `/ticket` or `/approve` |
| Before `/approve go` | only `docs/` can change: edits are refused, and so are shell commands that write (redirections, `sed -i`, `rm`, `git apply`, inline scripts…); no commit, no push |
| Documents | `03-…` needs `functional`, `04-…` needs `technical`, `06-…` to `09-…` need `go`, `10-…` needs `merge` |
| During implementation | each agent is held to its write scope; `developer` and `test-engineer` to the files their tasks own in `04-tasks.json` |
| After a quality run | Claude cannot hand back while the last run is red or the code changed since, whether by an edit or a shell command |
| `/approve merge` | accepted only if the last quality run is green and the code unchanged since |
| Session start, resume, compaction | the active ticket, its step and the next action are put back in the context |

The shell checks are a guard rail, not a sandbox: they recognise the usual ways of writing a file from a command line and say why they refuse. They are there to stop an agent from drifting, not to resist someone determined to bypass them.

## The knowledge base

The retro (step 10) writes into a **project skill**, versioned with your code:

```
.claude/skills/project-knowledge/
  SKILL.md          index: one line per topic
  references/       one file per topic: architecture, persistence, testing…
```

An entry is one rule, why it exists, an example in your code, and the ticket it came from. It is added only when it is specific to your project, useful beyond the ticket, not already written in an ADR or the conventions, and **validated by you**. Because it is a project skill, Claude reads it in every session, inside or outside this workflow.

Order of authority, highest first: the decisions of the current ticket, the ADRs, the knowledge base and conventions, the surrounding code, the plugin's general principles.

## Functional documentation

At step 8 the `functional-reviewer` writes the rules now in force where your project keeps them: your specification folder if you have one (`specsPath`), otherwise a small `docs/functional/<area>.md` it maintains, in business words, with the ticket each rule came from.

## Settings

`.claude/spring-agentic-workflow.json`, created by `/setup`:

| Key | Default | Meaning |
|---|---|---|
| `coverageThreshold` | `80` | minimum line coverage (JaCoCo) |
| `sonar` | `false` | run the Sonar analysis and wait for its quality gate (`SONAR_TOKEN` required) |
| `buildCommand` | auto | overrides `./mvnw -B verify` or `./gradlew check jacocoTestReport` |
| `specsPath` | none | folder of your functional specifications |
| `knowledgePath` | `.claude/skills/project-knowledge` | where the retro writes |

## What goes in git

Commit `docs/tickets/<ID>/` (documents and `approvals.json`), `docs/functional/`, `docs/adr/` and `.claude/skills/project-knowledge/`. Ignore the local state; `/setup` adds these lines:

```
docs/tickets/.active
docs/tickets/*/state.json
docs/tickets/*/.dirty
docs/tickets/*/.snapshot
```

## Portability

Nothing in the method depends on one AI vendor. What is tied to Claude Code is the wiring, and it is thin.

| Part | Where | Tied to Claude Code? |
|---|---|---|
| Gate logic: what may be written, when, by whom | `hooks/gates.mjs`, plain Node functions with tests | no |
| Quality checks and review knowledge base | `skills/quality-gates/run.mjs`, `skills/final-review/build-review-kb.mjs` | no |
| Workflow steps, agent roles, review lenses, principles | Markdown under `skills/` and `agents/` | no, apart from the front matter |
| Ticket documents, approvals, project knowledge base | Markdown and JSON in your repository | no |
| Hook registration, plugin manifest, slash commands | `hooks/hooks.json`, `.claude-plugin/`, skill front matter | yes |

To run it in another AI coding tool, write a small adapter that calls the same functions from that tool's own hooks, and load the Markdown as that tool's instructions. Two things depend on what the tool offers: refusing a write before it happens needs a hook that runs before each tool call, and the per-agent write scopes need the tool to say which agent is calling. Where a tool has neither, the same checks can run at commit time.

## Limits

- Written for Java / Spring back ends built with Maven or Gradle. A front-end part is handled by the same `developer` agent, following the project's patterns.
- File ownership is checked per agent type: two `developer` agents running in parallel share the union of the files owned by `developer` tasks. The plan keeps their files disjoint.
- The shell checks work on the text of the command. An unusual command can be refused by mistake (the message says why) or slip through.
- Code changes made by shell commands are detected through git; outside a git repository only edits are tracked.

## Development

```
node --test                              # hooks and scripts, no dependency
node docs/build-workflow-diagram.mjs     # rebuilds docs/workflow.svg
claude --plugin-dir .                    # try the plugin locally
```

## License

MIT
