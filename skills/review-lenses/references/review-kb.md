# Lens · What the team already said (review knowledge base)

Question: **would a reviewer of this team write, on this diff, a comment they have already written before?**

The team's past review comments are in `docs/review-kb/review-comments.md`, grouped by theme, each with the code it was about and no author name. Remarks that come back often are the team's real rules, even when no convention file states them.

If the file is missing or empty, say so and stop: there is nothing to review against.

## Method
1. Read the knowledge base. Note the remarks that come back several times, and the kind of code each was about.
2. Read the diff of the ticket.
3. For each place where the new code repeats what a past remark asked to change, report it.

## A finding needs
- the file and line;
- what the team would say, in one sentence;
- **the past comment you rely on, quoted**;
- the fix.

## Rules
- Only report a match you can defend with a past comment. No past comment, no finding.
- A remark made once, years ago, about different code is weak evidence: prefer the ones that come back.
- If a past remark contradicts an ADR, the technical plan or the project's knowledge base, the written decision wins. Do not report the code; mention the conflict under "Questions" so the team can clean up the knowledge base.
- Severity is "should fix" by default. Use "must fix" only when the past comments show the team blocks pull requests on it.
