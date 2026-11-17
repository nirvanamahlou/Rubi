# PR1776 CI repair and server publication — 2026-11-17

PC-C; source PR1776 final head e4596d12ad11c0fcdcaf1a83f2d367f21d95ddac merged into develop as4d1182948e7b83d872858267cddab974b244e668 after all8 hosted gates succeeded. Authenticated GitHub account/author Amin-tech11 verified. No gate was removed, skipped or weakened.

## Root causes and repair

The old merge snapshot inherited a synchronous state change in an Integrations effect. Current develop contained the producer's useTicketPublicationLink fix. Subsequent verification exposed three inherited formatting failures, an outdated PostgreSQL fixture missing hrLeaveRecipient, six missing English labels and the required API mirror. Preserve the concurrently published stronger actor/branch fixture and canonical translations from PR1782, plus the site-filter work from PR1781. Format-only source changes were checked through TypeScript AST equivalence. Move own task notes into stable historical sections to avoid repeated append conflicts during concurrent merges. Full final-head quality, production builds, PostgreSQL and tests passed for push and PR.

## Coverage and publication

Complete merged-author inventory:182 PRs. Earlier release receipts cover175; all18 runtime files from the six subsequent Nora PRs1766/1768/1769/1774/1778/1779 exactly match deployed source, verified again after activation. PR1776 records the original UI rollout and integrates the CI repairs; its executable formatting deltas do not change behavior. Publish six English entries into the actual live Web catalog and the one API-visible message into its source/compiled catalog, preserving peer source and every other entry. No full-develop source overwrite.

Web: rubi-production:amin-pr1776-1117-web. Full Next compilation/typecheck,46 isolated i18n tests across10 files, isolated login/static canary, source hashes, previous/current static assets and public health passed. All four NEXT_PUBLIC flags used by Web are included in the build. API: rubi-production:amin-pr1776-1117-api; source/compiled JSON hashes and preservation of original catalog values verified.

Verified encrypted database/configuration backups and rollback retained under /opt/rubi/backups. No migration, dependency, permission or business-data mutation was introduced. No real model conversation, test customer/order/payment or outbound communication was generated.

## API/Worker network dependency

The first API-only activation failed the real Worker transport gate and rolled back. The Worker was still sharing the removed API container's network namespace (network_mode: service:api); DNS probes returned EAI_AGAIN. Waiting alone did not repair the stale namespace. Restore/recreate Worker against the current API, verify transport/AMI, take a fresh verified backup, then activate API and recreate Worker together. Final activation verifies Worker NetworkMode references the actual new API ID, while its image, environment and mounts remain unchanged. Rollback must also recreate Worker after restoring API.

Final public HTTPS/API health, authenticated Worker pending transport, AMI_CONNECTED and recording timer passed. Native Nora/read-boundary identities remain unchanged; current Nora runtime hashes still match all18 reviewed files. The Web, API and dependent Worker were replaced deliberately; all other services/settings/mounts remain preserved.

Root-only receipts: /opt/rubi/amin-pr1776-release-1117/verified.json, api-verified.json, worker-network-repair.json, ci-approved.json, build.log, tests.log, canary-verified.json and backup-verified.json. DEPLOYMENT-RECORD.txt appended. Private environments, provider keys, backups and raw logs are not committed.
