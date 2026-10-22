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
