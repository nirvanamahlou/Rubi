# Master Data API and form functional QA — 2026-09-28

Owner: PC-B. Base: `codex/pc-b-bank-branches-in-bank-profile-0928`. Scope: Master Data API, its HTTP validation and Web form payloads. The broader monorepo API suite was also run. No live customer/business records, payment or external message was touched.

## Checklist and evidence

| Area | Check | Result |
| --- | --- | --- |
| Generic Master Data API | create/update, reference validity, optimistic version, list/filter, safe deletion, export, status, permission and form policy unit cases | 453 Master Data API unit cases passed before correction; 1,688 cases passed in full API suite after correction |
| HTTP boundaries | DTO validation, pagination, geography filters, rate quote/decision, meal/service create and permission/error cases | 27 passed |
| Real persistence | isolated PostgreSQL partner, meal/service, transport, travel-reference, terminal and safe-deletion suites | 57 unique cases passed after supplier correction |
| Form payloads | untouched masked phone remains omitted; explicit clear and replacement retained | 3 new Web payload cases passed; 376 Master Data Web cases passed overall |
| Static quality | affected ESLint, API/Web typecheck, API/Web production builds | passed; Web build generated 53 routes |

The full API run reported 175 skips, primarily opt-in PostgreSQL or environment-dependent suites. These are **not** counted as passing. The explicit demo PostgreSQL suite could not be exercised safely in this checkout: its guard only allows localhost port 55432, currently mapped to the running application database. Its initially attempted run on an isolated port was rejected by the guard; no bypass or write to the application database was made. No authenticated browser form-submit run was performed against the live application.

## Confirmed defect and correction

**Supplier protected phone not cleared.** Preconditions: a standalone supplier with a saved phone. Update via API with `primaryPhone: ''`. Expected: encrypted phone, IV, auth tag, key version, fingerprint and mask all become null. Actual before fix: encrypted phone and mask persisted. Isolated PostgreSQL reproduced this, then passed after the backend correction.

The Web edit form initially displays no plaintext phone. Therefore an unrelated edit submits an empty input unless guarded. The form now omits `primaryPhone` when untouched, explicitly offers clearing the masked saved number, and submits an empty value only when the user intentionally clears it. Tests cover omit, clear and replacement. A supplier edit of another field preserves its stored phone; clearing it removes all protected columns. Audit/list payloads do not contain plaintext.

The older partner PostgreSQL fixture assumed suppliers still require Organization/contact links and omitted supplier name. It was split: broker checks retain Organization/contact behavior; supplier checks assert the current standalone contract, real persistence, masking, audit and stale-version rejection.

## Risk and handoff

This is a bounded, reversible privacy-data correction: no new access path, schema, migration or contract. The `worker-orchestrator` launcher is unavailable in this checkout, so no independent worker review is claimed. Reviewer should inspect the explicit-clear versus omitted-field distinction and rerun the isolated supplier PostgreSQL test. The synthetic PostgreSQL container and all databases created for this QA were removed after verification. Localhost 3100 and operational databases were not changed.
