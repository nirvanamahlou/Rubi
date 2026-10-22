# Master Data logo antivirus exception — PC-B

Owner decision 2026-10-22 supersedes CLEAN-only logo delivery in the earlier
MASTER-LOGO-SAVE-DISPLAY-1021 contract. Only native Master Data logo uploads are
exempt; ordinary Documents, attachments and templates retain antivirus policy.

Preserve authenticated permissions, selected active branch/owner membership,
exact source/resource/record attachment, PNG/JPEG magic/type and5 MiB limits,
document policies, encrypted private storage, CAS, audit and cleanup. No public
URL or client-supplied bypass flag. Known infected/quarantined legacy logos
remain blocked; pending/failed scans no longer delay otherwise authorized logos.

No schema migration: the existing scanStatus remains unscanned
AWAITING_ANTIVIRUS_ADAPTER, never CLEAN. Explicit upload audit reason
MASTER_DATA_LOGO_ANTIVIRUS_EXEMPT records the owner-approved exception; no scan job
or quarantine policy row is created for new logo uploads. General archive
delivery remains scan-gated. This is an intentional accepted reduction in malware
screening for logos, not a claim that an unscanned file is safe.

Existing application topology and read-heavy internal reference workload retained;
no new capacity/SLO or architecture claim. Rollout requires backup, exact image
pinning, preservation of peer changes/private config and real HTTPS acceptance.

Validation:215 focused API tests pass across17 Documents/Master Data suites,
including no scan-job/quarantine rows for exempt uploads, ordinary upload jobs,
immediate exact-source logo preview and unchanged general preview gating.
Scoped ESLint passes. Build/full types, hosted checks and rollout pending.

## Production acceptance — 2026-10-22

PR1051 merged normally into develop as e2f7441a5b0fe88516bbf70d827edb71989cbf12
after all8 latest exact-head checks passed on19155382. A transient unrelated
reservation-purchases Web SSR5s timeout passed its focused7 tests and full retry
without changing source or test policy.215 API and27 logo Web regressions, scoped
lint and local API production TypeScript build pass; hosted full quality/types,
API/Web builds, tests and PostgreSQL gates pass.

Current production advanced from d3880878 to73ad32b5 while preparing rollout.
Preserved it and rebuilt on that image. Activated only the API image
rubi-production:logo-exempt-73ad-19155382-1022; Web/Worker/scanner/updater and private
configuration/volumes remain unchanged. Backups are server-private in
/opt/rubi/logo-exempt-1022-final: encrypted PostgreSQL dump fully decrypted and
parsed, encrypted document files copied, private config backed up. No migrations
or seed. Prior image/config retained for rollback; config hash CAS guards peers.

Native authenticated HTTPS tests against temporary bank+hotel records confirm
upload, immediate first preview (74ms/70ms, no polling), reopen, replacement and
byte comparison. New versions remain unscanned, processing-job count0, exemption
audits present. Wrong MIME, oversize, stale version and anonymous preview are
rejected. Independent fresh browser reload renders the blue hotel logo in its
table. Only our own two synthetic records removed through native APIs; their
documents archived. Existing business records/logos untouched. API/scanner run
without restarts after activation; exact final evidence is on PR1051 and in
/opt/rubi/logo-exempt-1022. Source locks released. No orchestrator/delegation.
