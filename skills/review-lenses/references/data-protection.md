# Lens · Data protection (GDPR)

Question: **what does this change do with data about people, and is each use needed, protected and limited in time?**

Personal data is anything that points to a person, directly or by combination: name, e-mail, phone, address, identifiers, IP address, location, photo, and anything about health, beliefs or finances.

## Look for
**Minimisation**
- A new personal field that none of the agreed rules (`F…`) needs.
- An API response, export or event that carries more personal data than its consumer uses. Compare the DTO with what the screen shows.
- An entity returned as-is instead of a DTO.

**Logs, errors and metrics**
- Names, e-mails, phone numbers, addresses or personal identifiers in logs, exception messages, metric labels or traces.
- A `toString()` on an object with personal fields that ends up in a log.

**Retention**
- The ticket stores new personal data: is there a rule or an existing job that says how long it is kept and how it is removed? If none exists, that is a question for the business, not a defect in the code.
- Soft-deleted data that keeps personal fields forever.

**Access**
- Only the roles that need the data can read it. A broad "admin can see everything" added for convenience is a finding.

**Copies**
- Files, exports, caches, search indexes, events and backups that carry personal data: are they protected, and cleaned when the source is?
- Personal data sent to a third party or a new external service.

**Rights of the person**
- If the project supports access, correction or erasure requests, does the new data take part in them?

**Tests**
- Real personal data in fixtures, SQL scripts or recorded payloads.

## You do not give legal advice
You are not the data protection officer. When a point needs a decision from the business or the DPO (a legal basis, a retention period, a transfer), say so plainly under "Questions", and do not decide in their place.

## A finding needs
The file and line, the data concerned, the risk, and the fix or the question to ask.
