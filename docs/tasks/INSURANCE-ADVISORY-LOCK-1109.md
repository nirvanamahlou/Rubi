# INSURANCE-ADVISORY-LOCK-1109

PC-A; follow-up within the owner's existing authorization to repair, merge and deploy only insurance correction. No migration, dependencies, shared API change, provider-mode change or actual passenger issuance.

Production correction returned HTTP500, requestId596aa55f-68ad-482d-8083-62de261b709a. A synthetic transaction on the actual server reproduced Prisma P2010: `pg_advisory_xact_lock` returns PostgreSQL `void`, which Prisma's query-raw result decoder cannot deserialize. The previous mocked service tests did not exercise that decoder; the earlier envelope/dispatch repair therefore did not fix this failure.

Both correction save and provider confirmation now use one transaction-lock helper. Casting the result to text preserves the same lock key, lock lifetime and transaction serialization while returning a supported type. Authorization, version checks, customer audit, row locking and provider fingerprints remain unchanged.

The mandatory existing insurance PostgreSQL CI gate now also runs real Prisma-adapter regression checks: reproduce the original error, acquire/re-enter the corrected lock, deny a competing transaction, and release on commit and rollback. Only random synthetic advisory keys are used; no customer or policy data is changed. Bounded release must preserve live peer overlays, environment/mounts, unchanged Web/Worker images and migrations; recreate Worker for the API namespace and verify authenticated pending/AMI/recording readiness. Fresh encrypted checkpoint and rollback images remain required. No further backup retirement is authorized by this unit.

## Completion

PR1552 merged as `cda23c1ea2611e112f477e441e09ea2627c27777`; all8 push/PR checks succeeded for exact source head `f782ccecaf85ac3a93c03214318ca92a4a6acc5f`. Full quality/types/build/test and PostgreSQL gates pass.5 local CI-policy checks,41 candidate insurance tests and3 separate Prisma/PostgreSQL18 regression tests pass. The disposable database was isolated from production/provider networks and removed after testing.

API-only image `rubi-production:insurance-advisory-lock-1109-api` was built over current live source, preserving peer overlays. Only insurance.service.ts and its regression source were overlaid; no Web rebuild or replacement. Worker retained its image and was recreated for API namespace. Exact source hashes, unchanged environment/mounts/unrelated services/migrations, HTTPS health/assets, unauthorized insurance endpoint, authenticated Worker, AMI, recording timer and zero restarts pass. The compiled helper was then called against the live database in a read-only transaction that deliberately rolled back: `LIVE_COMPILED_PRISMA_LOCK_READ_ONLY_ROLLBACK_VERIFIED`. No actual passenger record was corrected or policy issued as a test; the user must resubmit the corrected form.

Fresh checkpoint `before-insurance-advisory-lock-1109-1794216741` passed decryption/archive checks and full offserver SHA-256 verification under `C:/Users/pc/Documents/Codex/backups/insurance-advisory-lock-1109`. No additional backup or build-context cleanup was performed. Root disk had1857761280 free bytes at acceptance; the bounded API-only rollout uses a measured1.5GiB headroom guard and keeps encrypted backup creation in tmpfs. Server receipts are in `/opt/rubi/insurance-advisory-lock-1109/backup-verified.json`, `offserver-backup-verified.json` and `verified.json`.

Rollback uses the recorded original API image/Compose under the shared deployment lease, recreating API/Worker while preserving current peer configuration; no database migration or data rollback is required. All source/central-CI task leases are released. Completion documentation is handed off separately from the already merged and deployed runtime source.
