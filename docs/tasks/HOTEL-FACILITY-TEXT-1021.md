# HOTEL-FACILITY-TEXT-1021

PC-B; codex/pc-b-hotel-facility-text-1021; owner authorizes tests, push/develop merge and production rollout after backup.

## Evidence and bounded repair

Production PostgreSQL reported value too long for varchar160 on INSERT master_facilities during Antalya commit. The supplied workbook parses46 rows without issues but physical row20 has one164-character facility. Prior preview omitted per-reference limits, so atomic commit rolled back rather than partially saving the workbook. No production rows were changed during diagnosis.

Widen MasterFacility.name to varchar500 with one forward migration, retaining existing IDs/FKs and both compound indices. This is a bounded text widening, not arbitrary unrestricted indexed text; a500-character UTF8 name and80-character category fit the existing B-tree tuple bound. Existing API shape and other consumers are unchanged. Every accepted facility is stored in full; no truncation, splitting or moving text into an unrelated field. Input above the supported limit receives physical row/column validation before commit. Other imported reference and hotel strings are checked against their actual storage limits, including joined gallery text. Optional blanks remain allowed. Existing normalization, permissions, signed staging/hash/token, file safety, duplicate policy, atomic transaction, CAS and audit remain intact.

## Rollout and rollback

Take a protected PostgreSQL custom-format backup on the server; verify archive and restore to an isolated scratch database before applying only pending approved migration. Build exact merged immutable image, preserve the existing image/config, migrate before API/Worker rollout, health-check and verify live schema/code plus error-free readiness. Do not insert real hotel data as a deployment test. Previous application remains compatible with the widened column; rollback retains widening/data. Narrowing is prohibited while any name exceeds160. No secret in Git/logs.

## Verification

90 focused parser/service/permission/accommodation tests and4 real PostgreSQL scenarios pass. All181 migrations applied on a new disposable QA database; actual preview/commit/reopen/duplicate-SKIP preserves164/500-character facilities, including500 four-byte characters with the compound index. Preview rejects501 characters and overlong room/meal/hotel data before writes; later manual facility edits retain full text and validate bounds. Scoped lint passes. Initial integration fixture used the wrong reduced-format column and was corrected; initial local types found stale generated shared packages, refreshed before rerunning. No passing result is claimed for those initial attempts. Local pg-driver concurrency deprecation is pre-existing.

Schema-analyzer helper misreads parameterized VARCHAR SQL and reports the already-present unique code as missing; no schema constraint is removed to satisfy that false diagnostic. Prisma migration/schema validation and actual PostgreSQL compound-index boundary tests are authoritative. No new query/index is introduced; existing index/identity/FK behavior stays intact.

API types and Prisma validation pass after regeneration. Initial local API build exhausted host memory; sequential retry/full exact-head hosted build remain required, not bypassed. Pending: final-head hosted gates and production backup/rollout evidence. No real hotel import or operational migration has run. Bounded source/schema reservation freezes/releases at candidate publication.
