---
name: understand-requirement
description: Step 1 of the Spring agentic workflow. Reads a ticket, maps it to the existing code base, ADRs, project knowledge and constraints, and writes 01-understanding.md with a size estimate. Use only when a ticket is active at step 1, right after /ticket, or when the developer asks to redo the understanding of the active ticket.
---

# Step 1 · Understand the requirement

Goal: before any question or design, know what the ticket asks and what it touches in the code that already exists.

## Inputs
- The ticket text in `docs/tickets/<ID>/00-ticket.md`.
- The project's knowledge base (`.claude/skills/project-knowledge/`), `docs/adr/`, the conventions file, `CLAUDE.md`.
- The code itself.

## How to work
1. Delegate the exploration to the `analyst` agent. Give it the ticket text and the ticket folder path. It reads a lot so that this conversation does not have to; it cannot write.
2. Check its output before writing the file. Open the places it cites for the code that will change, and confirm the line numbers: an agent can be right about the code and wrong about the line. If a statement about the code has no file reference, verify it yourself or remove it.

## Output: `docs/tickets/<ID>/01-understanding.md`

```markdown
# <ID> · Understanding

## What is asked
One paragraph, in the business words of the ticket.

## Where it lands in the code
- `path/to/File.java:line`: what it does today, what will probably change.

## Existing rules and constraints
- ADR-00X: ...
- Project knowledge: ...
- Business rule already coded in `...`: ...
- Technical constraint (transactions, security, performance, data protection): ...

## What the build enforces
Checks that exist only in the build and that this change will meet: a test that keeps files in sync, an architecture test, a formatter, a linter.

## Gaps and contradictions
What the ticket does not say, or what conflicts with the code or an ADR.

## Size
small | medium | large, with one line of justification.
```

## Size guide
- small: one class or one endpoint, no new data, no cross-cutting rule.
- medium: several classes in one module, a new field or table, a new business rule.
- large: several modules or services, data migration, security or personal data involved, or a new ADR is likely.

## Then
Give the developer a three-line summary: what is asked, where it lands, the size.

- **Small ticket**: always offer the choice, whatever the number of open points, as long as each one can be answered in a line and none is about the data model, security or personal data. List the open points with the offer, so the developer can judge. "This looks small. Normal path (functional questions, technical plan, implementation plan), or fast path (one short plan, one approval)?" If they choose the fast path, run the `fast-plan` skill; their answers to the open points go into the plan. Never choose it for them.
- **Otherwise**: go to step 2 with the `functional-questions` skill.
