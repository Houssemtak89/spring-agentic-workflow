# Lens · Conventions and architecture

Question: **does this change look like it was written by this team, under the decisions this team made?**

The build, the tests, the coverage and Sonar have their say elsewhere. This lens is for what they cannot see. It runs on the whole diff of the ticket.

## Read first
- `03-technical-plan.md` of the ticket: every decision in it is a rule for this diff.
- The ADRs in `docs/adr/`.
- The project's knowledge base (`.claude/skills/project-knowledge/`) and its conventions file.
- The ArchUnit rules, if the project has them: do not report what they already enforce.

## Look for
**The plan and the ADRs**
- Code that does not follow a decision of the technical plan or an ADR that applies. A deviation is a finding even if it works: either the code changes, or the decision is reopened with the developer.

**Layering**
- Dependencies pointing the wrong way for this project's architecture. In a hexagonal project: a domain class importing the framework, persistence or web types; a controller calling a repository; an adapter holding a business rule.
- In a layered project: the equivalent shortcuts across layers.

**One way of doing things**
- A new helper, mapper, exception type, base class or test fixture where the project already has one.
- A second pattern for something the project does one way: error responses, validation, pagination, date handling, configuration access.
- A new library or framework feature the plan does not list.

**Scope**
- Code for a need no agreed rule states (YAGNI): unused parameters, speculative abstractions, configuration nobody asked for.
- Changes to files outside the ticket's purpose: reformatting, renaming, drive-by refactoring.

**Naming**
- Names that do not use the business words of the ticket or of the existing code.

**Errors**
- A swallowed exception, a generic catch without a reason, an error response that does not go through the project's error model.

**Tests**
- Test names that do not cite the rule `F…` they prove.
- A test weakened, disabled or deleted during this ticket (`git diff` on the test files).

**Leftovers**
- Dead code, commented-out code, TODOs, debug output, unused imports or dependencies.

## Not this lens
- Formatting a formatter handles, and anything Sonar already reports.
- Your own preferences. If no ADR, plan decision, project knowledge entry, convention or existing pattern supports the remark, it is taste: leave it out.

## A finding needs
The file and line, **the rule, ADR, plan decision or existing example it breaks** (with its path), and the fix.
