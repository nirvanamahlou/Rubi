# INSURANCE-CORRECT-SUBMIT-1109

PC-A; owner authorizes develop merge after green final-head gates and a bounded Avina release of this correction only.

Automatic insurance draft correction previously saved a queued request but waited for the periodic dispatcher. After the correction transaction commits, the controller now requests an immediate existing automation attempt. The durable dispatcher remains the retry fallback; processing leases, submitted fingerprints, provider reconciliation, authorization, version checks and customer identity auditing remain authoritative. Manual policies retain save-only behavior. No provider credentials, endpoint mode, migrations, dependencies or shared response contracts change.

The Web client reads the API's nested error envelope, and invalid draft input identifies the field without echoing personal data. Draft strings are trimmed, failed corrections remain open, and pending automatic drafts refresh until the provider result is available. An acknowledged draft does not mean confirmed coverage. The currently configured provider remains sandbox.

Validation: 41 focused API tests and16 focused Web tests pass. Scoped Web lint and full Web types pass. API lint/types/build and Web production build are required before release, followed by all final-head hosted gates. Provider tests use mocks; no real customer issuance is used for validation.

Deployment must preserve current live peer source overlays and change only the insurance runtime files. It must use the shared server deployment lease, a fresh encrypted backup, exact source checks, unchanged environment/mount checks, health/static asset checks and Worker/AMI/recording readiness. No full develop deployment is authorized by this task.

Disk authorization: the owner explicitly approved retiring only `before-source-share-legend-1105-1793871578` and `before-call-center-panel-scope-1105-1793869010`, after verifying a newer complete backup. The retirement helper verifies encrypted SHA-256 values, decrypts every component, checks database archive listing and tar integrity, then validates exact immediate-child paths before deletion. All other backups remain outside scope. Retirement and rollout receipts are retained on the server.

## Completion

PR1546 merged as `cc34a653bdad830354d0ce8a39cf3839902aaf65`; all8 push/PR hosted checks succeeded for source revision `4fd39e8eebf27e360353103401cc24381c76493c`. Local builds hit disk exhaustion; full hosted production builds and separate network-isolated production candidate builds passed. Actual candidates pass41 API and19 Web/translation tests and Web canary.

Bounded production activation completed with exact insurance source hashes and preserved live peer overlays. API/Web images are `rubi-production:insurance-correct-submit-1109-api` and `rubi-production:insurance-correct-submit-1109-web`. Worker was recreated with its unchanged image for the API network namespace. Environment hashes, mounts, unrelated services and migrations remain unchanged. Health, old/new static assets, unauthorized insurance access, authenticated Worker pending endpoint, AMI, recording timer and zero application restarts pass. No passenger issuance was used for testing; sandbox remains configured.

The approved old backups were retired after all components of `before-develop-0fb77974b-verified-current-1109-1794203636` passed SHA-256/decryption/archive checks. Fresh checkpoint `before-insurance-correct-submit-1109-1794213721` passed server archive validation and offserver SHA-256 verification. An incomplete local database copy was removed and replaced with a complete verified copy under `C:/Users/pc/Documents/Codex/backups/insurance-correct-submit-1109`. The user approved Z as an alternate destination, but Windows denied access and the user could not connect it. Sufficient C capacity subsequently became available; no network-share files were written.

Server receipts: `/opt/rubi/backups/insurance-backup-retirement-1109.json`, `/opt/rubi/insurance-correct-submit-1109/offserver-backup-verified.json`, and `/opt/rubi/insurance-correct-submit-1109/verified.json`. No migration/dependency handoff remains. Runtime rollback is the recorded original Compose/images under the shared deployment lease; preserve encrypted checkpoints.
