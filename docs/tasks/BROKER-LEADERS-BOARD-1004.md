# Broker cities, tour leaders and airport Board

Owner approval: bounded PC-A execution of Master Data producer and Reservations consumer; PC-B retains permanent Master Data ownership.

New broker form: Persian name, English name, encrypted broker phone, airport pickup Board text, country, multiple cities, and multiple named tour leaders with encrypted phones. Broker save and leader mutations are one transaction. Existing phone input omission preserves encryption; ordinary reads remain masked. Leader versions protect concurrent edits. Removing a leader deactivates it.

The existing Reservations-authorized audited leader contact endpoint additionally returns the broker Board. Selecting a leader fills voucher transferBoard, leaderName and leaderPhone. Changes of broker clear previous selection; stale async contact responses must not overwrite newer choices.

Additive nullable broker contact columns and restrictive FK city-link table, legacy city backfill. Apply migration before API rollout; no operational migration or local rollout is part of this request. Generic broker API inputs omit new values for backwards compatibility.

Validation: 496 API and 604 Web/voucher tests, final API 111; API/Web production builds with 55 Web routes, scoped lint/typecheck and Prisma validate/generate passed. Actual selector response-race behavior is exercised with a captured-hook component harness; form controls use real SSR fields. Authenticated live browser operations were not performed. The local database connection was unavailable; PostgreSQL 18 migration/seed CI must pass before merge. No operational migration/runtime rollout.

Integration retains develop changes for independent insurers/brokers, signatory proof upload and meal-service column labeling. Both parallel ledgers are preserved. Temporary locks release with delivered commit; apply the new broker migration before API rollout.
