# INSURANCE-ADVISORY-LOCK-1109

PC-A; follow-up within the owner's existing authorization to repair, merge and deploy only insurance correction. No migration, dependencies, shared API change, provider-mode change or actual passenger issuance.

Production correction returned HTTP500, requestId596aa55f-68ad-482d-8083-62de261b709a. A synthetic transaction on the actual server reproduced Prisma P2010: `pg_advisory_xact_lock` returns PostgreSQL `void`, which Prisma's query-raw result decoder cannot deserialize. The previous mocked service tests did not exercise that decoder; the earlier envelope/dispatch repair therefore did not fix this failure.

Both correction save and provider confirmation now use one transaction-lock helper. Casting the result to text preserves the same lock key, lock lifetime and transaction serialization while returning a supported type. Authorization, version checks, customer audit, row locking and provider fingerprints remain unchanged.

The mandatory existing insurance PostgreSQL CI gate now also runs real Prisma-adapter regression checks: reproduce the original error, acquire/re-enter the corrected lock, deny a competing transaction, and release on commit and rollback. Only random synthetic advisory keys are used; no customer or policy data is changed. Bounded release must preserve live peer overlays, environment/mounts, unchanged Web/Worker images and migrations; recreate Worker for the API namespace and verify authenticated pending/AMI/recording readiness. Fresh encrypted checkpoint and rollback images remain required. No further backup retirement is authorized by this unit.
