# Lens · Performance

Question: **what happens to this code when the data is a hundred times bigger or the calls a hundred times more frequent?**

## Look for
**Queries**
- N+1: a loop or a stream over entities that touches a lazy relation, or a repository call inside a loop. Propose a fetch join, an entity graph, a batch fetch or a projection, the way the project already does it.
- A new query without a matching index. Read the `WHERE`, `JOIN` and `ORDER BY` columns and look for the index in the migrations.
- `LIKE '%…'`, functions on indexed columns, implicit type conversions.
- A list that grows without pagination or a limit.
- Loading whole entities when a projection would do; `findAll` followed by filtering or counting in Java.
- Several queries where one would do, or one query repeated in the same request.

**Transactions**
- Work inside a transaction that does not need it: an HTTP call, file I/O, a message publish that should happen after commit.
- A transaction held open across a slow operation, or a read-only use case not marked as such when the project does so.
- Lazy loading outside a transaction, relying on open-session-in-view.

**Concurrency and threads**
- Blocking calls in reactive code, or the reverse.
- A shared mutable object, a non-thread-safe formatter or collection in a singleton bean.
- Unbounded thread pools or queues.

**Memory and CPU**
- A whole file, result set or collection loaded in memory when it could be streamed.
- Object creation, regex compilation, reflection or logging string building in a hot loop.

**Caching**
- A cache the plan asked for and that is missing.
- A cache without eviction, without a size limit, or keyed so that entries never match.

## Not this lens
- Micro-optimisations with no measurable effect. Report what matters at the scale this code will see.
- Sonar's generic performance rules.

## A finding needs
The file and line, **why it is slow with an order of magnitude** ("one query per appointment: 500 appointments, 501 queries"), and the fix. Say what would confirm a doubt (the SQL log, a query plan, a test with more rows) and confirm it yourself when you can. If nothing is worth fixing, say so in one line.
