---
name: engineering-principles
description: The small set of engineering principles that hold on every project (DRY, SOLID, YAGNI, KISS, clear errors, readable code, honest tests) and how they rank below the project's own rules. Use when writing, reviewing or planning code in a project that uses the Spring agentic workflow, and whenever a design choice has no project rule to settle it.
user-invocable: false
---

# Engineering principles

These are the only rules this plugin brings with it. Everything else is learned from the project.

## Order of authority
When two sources disagree, the higher one wins:
1. what the developer decided for this ticket (`03-technical-plan.md`);
2. the project's ADRs (`docs/adr/`);
3. the project's knowledge base (`.claude/skills/project-knowledge/`) and its conventions file;
4. how the surrounding code already does it;
5. the principles below.

So read the project first. Open `.claude/skills/project-knowledge/SKILL.md` if it exists: it is an index, and it tells you which reference file to read for the layer you touch. A principle below is a default for the cases the project has not settled, never a reason to rewrite code that follows a project rule.

## The principles

**YAGNI — build what was asked.** Implement the agreed rules and nothing else. No parameter, extension point, configuration flag or abstraction for a need nobody stated. Code that is not there has no bugs and needs no tests.

**KISS — the simplest thing that satisfies the rule.** Prefer the plain solution a new team member reads once. Cleverness needs a measured reason.

**DRY — one place for each piece of knowledge.** A business rule, a format, a mapping lives in one place. Reuse the project's existing helper before writing a second one. But two pieces of code that look alike and change for different reasons are not duplication: do not merge them. Wait for the third occurrence before extracting.

**SOLID, as questions to ask:**
- *Single responsibility*: can you say what this class is for without "and"? Does it change for one reason?
- *Open/closed*: does a new case mean adding code, or editing a growing `if`/`switch` in several places?
- *Liskov*: can every implementation be used wherever the interface is expected, with no caller checking the concrete type?
- *Interface segregation*: does a caller depend on methods it never uses?
- *Dependency inversion*: does the business logic depend on an abstraction it owns, with the framework and the database plugged in from outside?

These are diagnostics for code that is hard to change, not targets. An interface with one implementation and no test double is usually YAGNI losing to SOLID.

**Separation of concerns.** Business rules do not know about HTTP, SQL or the framework. Edges translate; the core decides.

**Errors are part of the behaviour.**
- Never swallow an exception. Catch only what you can handle, where you can handle it.
- Fail early with a message that says what was expected and what was received.
- Use the project's error model; do not invent a parallel one.
- No secrets and no personal data in logs or error messages.

**Readable code.**
- Names use the business words of the ticket and of the existing code.
- A comment says why, when the why is not obvious. It does not repeat the code.
- No dead code, commented-out code, leftover TODO or debug output in what you hand back.
- Small functions with one level of abstraction; no hidden side effects.

**Honest tests.**
- A test proves a rule: it sets up the situation and asserts the business outcome.
- Never weaken, skip or delete a test to make the build pass.
- Test-first is a choice made with the developer for each ticket (see the technical plan), not a default.

**Evidence before claims.** Do not say "it compiles", "tests pass" or "this is the cause" without having run the command and read its output in this session.

**Leave things as you found them.** Do not reformat, rename or refactor code your task does not own. An improvement you notice is a note for the developer, not a silent change.
