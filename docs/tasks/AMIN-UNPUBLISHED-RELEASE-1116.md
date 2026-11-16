# Amin merged PR publication — PC-C — 2026-11-16

The owner explicitly authorizes publishing Amin-tech11 PRs merged into develop but absent from production. Isolated work branch codex/pc-c-amin-unpublished-release-1116; no feature or main/develop source edit is required.

## Inventory and bounded scope

Authenticated GitHub identity Amin-tech11/211146168 verified. Reviewed the complete171 author-owned PRs merged into develop (GraphQL pagination), with a separate44-PR recent inventory. The actual deployed API/Worker baseline47343a9a9e0a40fa1df2c084e7ad551e453b2cd4 already includes169 of these merge commits. The remaining two are ancestors of the published bounded source revision. Compared4822 API/Web/Worker source entries and57 actual Nora/read-boundary entries against that baseline and the desired merged source. Native Nora and read-boundary sources match the baseline; no independent native release is needed.

Two remaining merge commits: PR1743 db7487154e14dcf4164bc97f3b01f7a86ae084c8 and PR1746 48d056540eb0a6b19821e7883e5d2df1f341e1dd. The PR1746 route is already on production; its helper lacks the final same-host TLS fallback, so include the exact merged helper and regression. PR1743 contributes ten Assistant source/test files and nine additive English entries. Its final e120116505828548da34b3e2f8cf1b38dc8b0902 has all eight hosted checks successful and includes the mail merge in its ancestry.

Derive Web from the immutable current site-tile-toggle-1116-web image. Copy only these bounded source files; merge English keys without discarding live entries. Preserve all current commerce/tile changes, previous static assets, public/documents mounts, runtime environment, SMTP settings and every other service. No schema, migration, grants, data repair, synthetic production fixture or outbound email. The shared avina-deploy.lock serializes build/backup/activation. Restore only the captured original Web image/Compose on a failed activation; leave all data untouched.

## Verification

Build, selected network-isolated synthetic regressions, isolated login/static canary, verified encrypted database/configuration backups and final public HTTPS/old-and-new assets/Worker/AMI checks are mandatory before completion. Deployment receipts remain root-only under /opt/rubi/amin-unpublished-release-1116. No secret or production result bodies are committed. Final outcome follows after successful rollout.

## Completed publication

Published PR1743 and the remaining final helper from PR1746 to rubi-production:amin-unpublished-1743-1116-web (immutable image sha256:69e316d43eccbbe892465ad8b005c410a4df8dbb64d79a22c44397887961b4f4). Full production Web build and TypeScript succeeded. All353 network-isolated candidate regression tests passed across35 files. Isolated login/static canary passed before activation.

Encrypted database/configuration backup passed decryption and restore/archive-list verification under /opt/rubi/backups/before-amin-unpublished-1116-1794827488. Exact source hashes, prior and new public assets, HTTPS login/API health, authenticated Worker transport, AMI connection and recording timer passed after activation. Web has zero restarts. API/Worker/database/Redis/document service identities, environments and mounts are unchanged; actual Nora and read-boundary container identities also remain unchanged, and the protected count endpoint rejects unauthenticated access. No new model-provider conversation, actual outbound mail or human call was generated as an acceptance test.

Receipt: /opt/rubi/amin-unpublished-release-1116/verified.json and DEPLOYMENT-RECORD.txt. All171 merged author PRs are covered by the169-merge baseline plus the two now-published changes; no open PR is represented as deployed. Other authors' live site-commerce overlays are preserved. Source repository main/develop branches were not modified by this operational release. Documentation is delivered on the independent release branch.
