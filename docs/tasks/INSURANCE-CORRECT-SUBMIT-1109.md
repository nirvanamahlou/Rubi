# INSURANCE-CORRECT-SUBMIT-1109

PC-A; owner authorizes develop merge after green final-head gates and a bounded Avina release of this correction only.

Automatic insurance draft correction previously saved a queued request but waited for the periodic dispatcher. After the correction transaction commits, the controller now requests an immediate existing automation attempt. The durable dispatcher remains the retry fallback; processing leases, submitted fingerprints, provider reconciliation, authorization, version checks and customer identity auditing remain authoritative. Manual policies retain save-only behavior. No provider credentials, endpoint mode, migrations, dependencies or shared response contracts change.

The Web client reads the API's nested error envelope, and invalid draft input identifies the field without echoing personal data. Draft strings are trimmed, failed corrections remain open, and pending automatic drafts refresh until the provider result is available. An acknowledged draft does not mean confirmed coverage. The currently configured provider remains sandbox.

Validation: 41 focused API tests and16 focused Web tests pass. Scoped Web lint and full Web types pass. API lint/types/build and Web production build are required before release, followed by all final-head hosted gates. Provider tests use mocks; no real customer issuance is used for validation.

Deployment must preserve current live peer source overlays and change only the insurance runtime files. It must use the shared server deployment lease, a fresh encrypted backup, exact source checks, unchanged environment/mount checks, health/static asset checks and Worker/AMI/recording readiness. No full develop deployment is authorized by this task.

Disk authorization: the owner explicitly approved retiring only `before-source-share-legend-1105-1793871578` and `before-call-center-panel-scope-1105-1793869010`, after verifying a newer complete backup. The retirement helper verifies encrypted SHA-256 values, decrypts every component, checks database archive listing and tar integrity, then validates exact immediate-child paths before deletion. All other backups remain outside scope. Retirement and rollout receipts are retained on the server.
