# STAFF-CDR-BACKFILL-1102

PC-C; owner authorizes showing employees' actual calls starting 1405/08/09 in their Call Center contact lists, for completion. Scope starts at 2026-10-30T20:30:00Z (midnight Tehran) and ends at the verified finalized-source snapshot on 2026-11-02. No application release, schema, dependency, permission, HR, or PBX changes.

## Evidence and boundaries

- Read-only Issabel CDR/CEL export: 304 CDR rows, correlated using physical channel starts, unique/linked IDs, trunk allowlist, finalized root ends, actual Dial disposition and bridged legs. Internal-only calls are excluded.
- Recovered calls use the existing private `receiveRecovered` port, root fingerprints, encrypted domain projector and stable recovery identities. No public upload endpoint or historical browser notifications.
- Three encrypted historical ERP backups provide minimal HR employee UUID/account/extension projections. The same employee UUID may complete its history through its current active linked account. This avoids guessing from names and avoids treating a later profile edit as loss of historical ownership.
- Owner additionally confirmed historical aliases from 1405/08/09: 111, 115 and shared 201. The private approval document intersects current authoritative IAM/HR routes; it does not grant general access.
- Answer access uses the Call Center `reprojectAnswer` port and retained receipt evidence. Origin access for real outbound calls uses inactive positive-version snapshots in the owning Call Center maintenance operation. It never marks an unanswered outbound call as answered.
- Existing business phone/name/subject/source/note and completed outcome are verified unchanged. Only proven technical answer/end facts and bounded historical access are reconciled. Old source identity replay is idempotent.
- A CDR answer to PBX playback is not an employee/customer conversation. Answered Dial legs without attributable bridge evidence retain completed-call status without inventing an answering employee.
- Accounts for 113 and 202 are INACTIVE; history is retained and those accounts remain disabled.

## Production result

144 finalized external sessions verified at the final snapshot: 118 already captured and 26 recovered. Planning after the initial recovery reported zero new roots; nine subsequent live sessions were already captured and their terminal evidence was reconciled. All expected contacts were found through the actual contact-list service and scoped contact lookup: 82 employee/contact checks across 14 active accounts. No new historical active offers and no duplicate roots. Encrypted, verified backups precede writes; the shared deployment lock protects each execution. API/Worker/Web are not restarted by this operation.

Receipts (server): `/opt/rubi/STAFF-CDR-BACKFILL-1102.json` and `/opt/rubi/private/staff-cdr-backfill-1102/verification.json`. Private source, backup keys, roster projections and live phone data remain outside Git.

## Validation / operator use

Six Node evidence regressions pass, including short services, playback false answers, trunk isolation, finalization, unknown invalid destinations and explicit date boundary. Node syntax and Prettier checks pass. Native PostgreSQL/application verification establishes real account list visibility; no fabricated production calls are used.

The maintenance script requires a verified private CDR/CEL export, historical roster projections, private current employee identity projection and (optionally) the owner's bounded alias approval. It defaults to planning. `--apply` is restricted to the operator's direct process; take and verify an encrypted backup first and hold `/opt/rubi/avina-deploy.lock`. The reviewed server runner supplies these private projections. This is a bounded historical operation, not a new automatic outage-recovery service.
