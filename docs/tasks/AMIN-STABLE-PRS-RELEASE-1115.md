# Verified stable PR publication — 2026-11-15 — PC-C

Owner authorizes publishing stable merged work while data Agent v3 stays off.
PR1693 contract guides/evidence/form recovery and bounded Sales recovery from
PR1708 are now published. PR1701 chart activation already exists in the live
baseline and is retained. PR1700 data Agent is excluded; no activation claim.

Runtime source22f85a6e3522c0c96f239b19e090a5e1a5a08ef2 derives from live source
a5c5bd04b2bd. Each source PR has eight successful head checks. Preserve current
server overlays rather than replacing peer website publication changes. Effective
source hashes and applied overlays are retained in the server prepared receipt.

API, Worker and Web production builds/types passed. Candidate API578 tests pass
(8 opt-in skips); Web731 pass (5 skips). Additional release API25 and Assistant/
submission/i18n Web182 pass. Isolated Web canary passed before activation.
The first candidate identified missing newer website Prisma models; preserve
current server database source/schema/migrations and rebuild. A stale standalone
English brand translation was then corrected to Niayesh Seir and tests rerun.
Public-file replacement was atomic to preserve old hardlinks. No test gate removed.

Final images: rubi-production:amin-stable-prs-1115-api, -web, -worker.
Deployment receipt: /opt/rubi/amin-stable-prs-1115/verified.json.
Activation success: API/Web healthy, Worker authenticated, AMI connected,
recording timer active;16 live files preserved, migrationsApplied empty.
Public HTTPS login200. Agent flags in API/Web remain false. Existing independent
Nora service and Germany egress remain unchanged. No business-record write.
Authenticated browser behavior is not newly certified by this release receipt.

Encrypted database/documents/configuration backup verified before activation:
/opt/rubi/backups/before-develop-f2a004229-initial-1794732651.
Rollback under /opt/rubi/avina-deploy.lock restores only this deployment's previous
Compose/images/public bindings after checking for later peer updates. Keep database
and operational rows; no migration rollback is required. Private archives remain
server-local. No credentials or customer data are included in this report.
