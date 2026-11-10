# HR-RADAN-PRODUCTION-1101

PC-B; owner explicitly authorizes activating the merged Radan integration in production. HR source is develop merge2b796d28d2e037fe763d732b0a337bbc4d37d006 / PR1268, including its approved Tehran schedule. No new application source change or migration in this deployment.

## Release and preservation

- API image: `rubi-production:hr-radan-1101-api` (73fa43f66e7e).
- Web image: `rubi-production:hr-radan-1101-web` (6af6ea7d78e3).
- Web base: `rubi-production:ghestiroo-setup-1101`; its integration setup and other live non-HR sources remain inherited unchanged.
- The actual current production images were captured under `/opt/rubi/avina-deploy.lock`; only HR sources matching their known merged baseline were overlaid. Concurrent earlier Call Center releases were detected and rebased before any production mutation.
- Current Call Center source and customer-affairs compiled-code hashes match before/after. Existing public-document mounts, credentials, grants and non-HR configuration remain unchanged. Prior static assets retained.
- Worker image remains f9d57d09b1e5; its container was recreated solely to reattach its shared network namespace to the new API. PostgreSQL, Redis and document scanning/signature containers were not recreated.
- Incremental builds reuse current dependencies. A measured build-space guard and2GiB activation floor remain enforced. Build cache is removed in its creating layer; only this task's unused failed candidate image was removed while retaining its runtime artifact archive. Existing user data, old releases and active images were preserved. Verified final free space exceeds the activation floor.

## Configuration and data ownership

Private `/opt/rubi/private/hr-radan.env`, mode0600, is appended to the API env-file list. It enables the existing server-only adapter through the existing workstation gateway at port3333. Native HR records for the Niyayesh Seir Sahar organizational company belong to the HQ native branch; that ownership and the existing09:15–17:00 working-hours definition were retained. No employee, account link, permission or working-hours definition was invented or moved.

The existing authorized native HR manager session is revalidated through IAM on every automatic pull, including rotation handling. Revocation/expiration fails closed and requires renewed authorized configuration. Provider credentials remain outside Git and image layers.

Automatic slots are Tehran09:00,09:15,09:30,09:45,10:00 and17:00,17:15,17:30,17:45,18:00, with full-hour slots otherwise. Startup does not add a pull; an explicit initial activation pull was authorized by the request. The workstation and its existing bridge must remain running and connected to the company network/Internet. No Windows startup persistence was added.

## Backup, rollback and acceptance

Encrypted database, document and private/configuration backups were decrypted/verified before activation; their encrypted off-server copies and Windows CurrentUser DPAPI recovery-key copy were verified before the release checkpoint. Receipts and hashes are private at `/opt/rubi/hr-radan-production-1101/backup-verified.json` and the matching offsite receipt. Original Compose configuration and image references are retained for code/config rollback. No database restore or deletion was performed.

Canaries validated module loading, native API health, authorized HR status, unauthenticated401, Web readiness, unchanged Call Center hashes and actual Radan login/user retrieval. Canary processes used the exact live runtime command, working directory and multiline environment without baking private values into images. Canaries were removed after acceptance.

Native production activation imported72 real punches and produced43 daily attendance rows over5 source days.27 have an exit,14 have positive lateness and8 have positive overtime. One recent source punch has an unmatched personnel code and remains unresolved; no identity or missing exit was invented. No source-system writes or synthetic production test data.

The actual automatic17:00 Tehran run completed at17:00:11 on2026-11-01:0 imports /72 unchanged, still72 punches and43 summaries. Next automatic slot17:15 Tehran. Public HTTPS API health, authenticated connector status and HR/time page all return200 without a login redirect. The Worker is running with0 restarts and shares the new API namespace.

Full merged-head CI gates and56 targeted API /9 Web checks preceded activation. Deployment receipt: `/opt/rubi/HR-RADAN-PRODUCTION-1101.json`; public acceptance receipt in the private deployment folder. No browser visual acceptance is claimed because computer-use initialization was unavailable.
