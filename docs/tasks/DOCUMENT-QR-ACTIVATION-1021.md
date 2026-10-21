# Document QR activation — verified

## DOCUMENT-QR-ACTIVATION-1021 — PC-A — LIVE VERIFIED

Owner-authorized PR1042 merged as bcf626ed and production header/startup follow-up PR1047 merged as 2a89a071. Avina Web activated at 2026-10-21T14:31:28.782050+00:00 using rubi-production:qr-bc67c332-city-744df105: QR source bc67c332 plus the exact pre-existing city form source744df105. The concurrent city rollout was detected by immutable image/config guards; its992 existing Web source files were checked against Git before preserving its three files. Unrelated HR producer/consumer and later Sales changes were not partially deployed. API/worker remain7b4fa80a; PostgreSQL/Redis/other service identities and existing volumes unchanged.116 isolated candidate tests and actual unauthenticated document/isolation/private-header/denied-creator HTTP checks passed twice across container replacement. Production login/API health200, unknown capability404 with strict headers and protected routes307 verified. Private durable store/key and encrypted DB/document/config-artifact backups are active; restore-list/integrity checks passed. No migration, seed or business-data rewrite. Legacy outputs must be downloaded again to contain URL QR codes. Private evidence: /opt/rubi/document-qr-activation-1021/{candidate-proof,activation-proof,production-proof}.json.


## Runtime and recovery

Public origin: https://avinaofficial.ir. Web uses the private /opt/rubi/private/public-documents.env file and writable /opt/rubi/private/public-documents bind mount at /srv/rubi/public-documents. The server-only256-bit key is generated once and preserved; never regenerate it during upgrades. Environment file mode0600, parent/storage private. The canonical compose keeps both the env file and persistent mount. Exact capability requests have Nginx access logging disabled before publication.

Encrypted checkpoint: /opt/rubi/backups/document-qr-20261021T142012Z. It includes PostgreSQL custom dump, existing documents and the original compose/Nginx plus public-document key/artifact folder. Backup hash and restore-list proofs stay private with production-proof.json. Include both artifact store and protected key in every subsequent backup/recovery and preserve the public origin for printed links. An immutable old document is unchanged by later edits; physical artifact removal revokes that one capability.

## Validation and boundaries

The initial isolated HTTP check caught global CSP replacement; the bounded production /d/:token header rule and standalone Next configuration regression fixed it before activation. Candidate tests use a separate key/storage, public-asset mount and network-none containers; no production business records were used as fixtures. Both valid synthetic document links returned200 without cookies and remained usable after container replacement; unknown tokens404, protected creation307, passenger isolation and restrictive headers passed. Synthetic containers were removed. Production smoke is read-only. API/worker/database/Redis identities stayed unchanged and no Prisma command or seed ran.

The deployment is intentionally a bounded Web overlay: it retains the already active city change744df105 and excludes unrelated newer HR producer/consumer changes. Its private integration manifest checks Git blob identities, and current source was verified before overlaying. The source commits are ancestors of approved develop; the image tag records both scopes rather than pretending it is an exact latest full-monorepo rollout. Full application build and116 focused/image tests pass.
