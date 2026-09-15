# Conventions

Agents read this file at every step. Keep it short and true: a rule nobody follows here will be enforced by the agents anyway. Copy it to `docs/conventions.md` and adapt it.

## Architecture
- Hexagonal: `domain` (model and rules, no framework), `application` (use cases, ports), `adapter` (web, persistence, messaging).
- A controller calls a use case, never a repository.
- One ADR per structural decision, in `docs/adr/`.

## Java and Spring
- Java 21 or later, records for value objects and DTOs.
- Constructor injection only.
- `@Transactional` on use cases, never on controllers or repositories.
- Errors: domain exceptions mapped to HTTP responses in one `@RestControllerAdvice`.
- No personal data in logs.

## Database
- Flyway, one migration per change, never edit a migration that has run.
- Every new query has a matching index, or a line in the plan saying why not.

## Tests
- Each agreed rule `F…` has a test whose name starts with the rule number.
- Unit tests for the domain, slice tests for adapters, Testcontainers for the database.
- Coverage threshold: 80% of lines.

## Reviews
- Review comments are rebuilt into `docs/review-kb/` once a month.
