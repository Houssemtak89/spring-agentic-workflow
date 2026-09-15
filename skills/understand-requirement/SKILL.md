---
name: understand-requirement
description: Step 1 of the Spring agentic workflow. Reads a ticket, maps it to the existing code base, ADRs and constraints, and writes 01-understanding.md. Use when /ticket starts a new ticket or when the understanding of a ticket must be redone.
---

# Step 1 · Understand the requirement

Goal: before any question or design, know what the ticket asks and what it touches in the code that already exists.

## Inputs
- The ticket text given to `/ticket` (or the file it points to).
- `docs/adr/` and any conventions file the project has (`CONVENTIONS.md`, `docs/conventions/`, `CLAUDE.md`).
- The code itself.

## How to work
1. Delegate the exploration to the `requirement-analyst` agent. Give it the ticket text and the ticket folder path.
2. The analyst reads; it does not change code.
3. Check its output yourself before writing the file. If a statement about the code has no file reference, verify it or remove it.

## Output: `docs/tickets/<ID>/01-understanding.md`

Use this structure, with short sentences:

```markdown
# <ID> · Understanding

## What is asked
One paragraph, in the business words of the ticket.

## Where it lands in the code
- `path/to/File.java`: what it does today, what will probably change.

## Existing rules and constraints
- ADR-00X: ...
- Business rule already coded in `...`: ...
- Technical constraint (transactions, security, performance, data protection): ...

## Gaps and contradictions
What the ticket does not say, or what conflicts with the code or an ADR.

## First size estimate
small | medium | large, with one line of justification.
```

## Size guide
- small: one class or one endpoint, no new data, no cross-cutting rule.
- medium: several classes in one module, a new field or table, a new business rule.
- large: several modules or services, data migration, security or personal data involved, or a new ADR is likely.

Update `docs/tickets/<ID>/state.json`: set `"step": 2` and `"size"` to the estimate. Then go to step 2 (`functional-questions`).
