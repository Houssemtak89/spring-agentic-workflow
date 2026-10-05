# Lens · Security

Question: **can someone make this code do, read or reveal something they should not?**

Think like the attacker for each new or changed entry point: who can call it, with what input, as whom?

## Look for
**Access control**
- An endpoint without the authorisation the rest of the API uses (security configuration, `@PreAuthorize`, method security). Compare with a neighbouring endpoint of the same kind.
- Access to another user's or tenant's data by changing an identifier in the path, query or body. The check must be on ownership, not only on being logged in.
- A role or permission check done in the front-end only.

**Input**
- Input that reaches a query, a file path, a shell command, a template or a redirect without validation or binding: SQL or JPQL built by concatenation, path traversal, open redirect.
- Mass assignment: an entity bound directly from a request body, so that a caller can set fields the screen does not show (role, owner, price).
- Missing limits: unbounded page size, upload size, list length, recursion in a parsed payload.
- Deserialisation of types chosen by the caller.

**Secrets and leaks**
- Secrets, keys or passwords in code, configuration files or test fixtures.
- Tokens, passwords or full request bodies in logs.
- Error responses that return stack traces, SQL, class names or internal identifiers.

**Configuration**
- CORS, CSRF, security headers or session settings changed without a reason in the plan.
- A new actuator or management endpoint exposed without protection.
- A new dependency with known vulnerabilities, when the build has a check for it. Run the check; do not guess.

## Not this lens
- Personal data minimisation and retention: `data-protection`.
- General error handling style: `conventions`.

## A finding needs
The file and line, the risk in one sentence, **how an attacker would use it** (the request they send, as which user), and the fix. If you cannot describe the request, you have a doubt, not a finding: read further until it is one or the other.
