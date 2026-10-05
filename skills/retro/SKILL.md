---
name: retro
description: Step 10 of the Spring agentic workflow, the retro-documentation. After the merge is approved, reads what the ticket taught (developer corrections, review findings, questions, failed checks), proposes short project-specific rules, and once the developer validates them writes them into the project's own knowledge base, a project skill that every later ticket reads. Use when the active ticket is at step 10, after /approve merge, or when the developer asks to record something the project should remember.
---

# Step 10 · Retro-documentation

The plugin starts with almost no rules of its own. What makes it good on a given project is what that project teaches it. This step turns one ticket's lessons into knowledge the next ticket starts with.

## Where the knowledge lives
In the project, as a project skill, so that Claude reads it in every session, inside or outside this workflow:

```
.claude/skills/project-knowledge/
  SKILL.md            the index: one line per topic, when to read it
  references/
    architecture.md   one file per topic, created when the first entry needs it
    persistence.md
    testing.md
    ...
```

If `.claude/spring-agentic-workflow.json` sets `knowledgePath`, use that folder instead. If the skill does not exist yet, create it from `${CLAUDE_SKILL_DIR}/../../templates/project-knowledge/SKILL.md`.

## 1. Collect what the ticket taught
Read the ticket folder and look for moments where reality differed from what an agent assumed. Those are the lessons.

| Source | What to look for |
|---|---|
| The developer's answers and approval notes (`02-…`, `approvals.json`) | a business or technical fact nobody could have guessed from the code |
| Decisions and "Already settled" in `03-technical-plan.md` | a pattern of the project that was not written anywhere; a recommendation the developer overruled, and why |
| Notes in `06-log/` | questions an agent had to ask; refusals; misunderstandings between tasks |
| Review findings (`06-log/review-*.md`, `08-review.md`) | the same kind of finding more than once; a finding the developer rejected |
| `07-quality-report.md`, "What failed along the way" | a check that failed for a reason specific to this project |
| The developer's remarks at step 9 | everything they asked to change: these are the most valuable |
| This conversation | every time the developer corrected you |

## 2. Keep only real knowledge
An entry earns its place when it is all of these:
- **specific to this project**: a general principle (DRY, SOLID…) is already in `engineering-principles`; a framework fact is already known;
- **useful beyond this ticket**: it will apply again;
- **not written elsewhere**: if an ADR, the conventions file or the functional documentation already says it, do not copy it. If it *should* be an ADR (structural, with alternatives weighed), propose an ADR instead;
- **backed by this ticket**: you can point to where it came from.

Most tickets teach two or three things. Some teach none: say so, and do not invent entries to fill the step.

## 3. Propose, and let the developer decide
Show the candidates in the conversation, each in this form:

```markdown
### <the rule, in one sentence, as an instruction>
- Why: <the reason, or what goes wrong otherwise>
- Example: `path/to/File.java:line` — <what to look at>
- Source: <ID>, <developer correction | review finding | decision D2 | failed check>
- Topic: <architecture | persistence | api | testing | security | front-end | build | domain | …>
```

Also list:
- **entries to change or remove**: an existing entry this ticket contradicted, or that an ADR now replaces;
- **ADR candidates** you would rather not bury in the knowledge base.

Ask the developer which to keep, change or drop. Nothing is written before they answer. Their wording wins over yours.

## 4. Write
For each entry the developer kept:
1. Open the topic file in `references/`, or create it.
2. If an entry already says the same thing, merge: keep one, add the new source. Never two entries for one rule.
3. If an entry says the opposite, replace it and note the ticket that changed it.
4. Update the index in `SKILL.md`: one line per topic file, saying when to read it.

Keep it small enough to be read. `SKILL.md` stays an index under a hundred lines; a topic file that grows past a couple of hundred lines should be split or pruned. An entry nobody has needed for a long time and that the code no longer reflects should go: ask the developer.

## 5. Close the ticket
Write `docs/tickets/<ID>/10-retro.md` last. Writing it closes the ticket: the plugin marks it done and switches the gates off.

```markdown
# <ID> · Retro

## Learned
- <entry> → `.claude/skills/project-knowledge/references/testing.md`

## Changed or removed
## ADR candidates
## Proposed and not kept
Kept here so the same proposal is not made again.
```

If the developer wants to skip the retro, write the file with "Skipped at the developer's request" and nothing else.

Tell the developer in two lines what the project now knows that it did not know before, and remind them to commit `.claude/skills/project-knowledge/` so the whole team benefits.
