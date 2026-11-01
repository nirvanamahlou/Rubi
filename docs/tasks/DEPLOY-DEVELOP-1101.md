# DEPLOY-DEVELOP-1101

COMPUTER_ID=PC-C. Owner explicitly authorized final develop publication to the ERP server.

## Published revision

- develop `409a6fa645a9b1c8f508f2bd92148e90de2d18a4` (PR1252), including reviewed Dashboard PR1251 and Call Center PR1249 history. All four merge-commit hosted gates succeeded; both final PR heads also passed all eight checks.
- API/Web/Worker images: `rubi-production:final-409a6fa645a9-api`, `-web`, `-worker`, built from image `e5bbdd7e0b09`.
- Existing live source overlays were compared against develop and their common base. Seven compatibility files were retained/merged; original runtime environment hashes, non-Web mounts and unrelated service identities remained unchanged. Web's public mount moved to the verified release asset directory. Nora services were retained.

## Validation

Full Contracts/Database/API/Worker/Web builds, source hashes, 27 API/HR checks, 17 Web checks and an isolated Web canary passed before activation. The first container test invocation inherited production NODE_ENV and four minimal HTTP fixtures lacked the production IAM directory, yielding403 before DTO validation. Rerunning unchanged tests in their standard NODE_ENV=test passed; no production authorization flag was disabled. Hosted migration and full-suite checks were also green.

Text merging initially duplicated the already deployed CallCenterAnswerResponsibility model at two schema positions. Canonical develop was verified to contain every live model and field before replacing only the candidate schema. Popup conflicts were limited to reviewed whitespace and receipt imports/actor identity; both refresh receipts and wakeup behavior remain covered by tests. No production schema was modified during these build repairs.

After activation: public login/API health and both old/new static assets passed; authenticated Worker pending transport, AMI_CONNECTED audit status and active rubi-call-recordings.timer passed. Live compiled DTO rejects missing outcome and accepts a valid outcome in memory; CallForm source has required result and simplified phone label. No synthetic business row was persisted. Authenticated human browser acceptance is not claimed.

## Data and recovery

Reviewed additive migrations applied: `20261031170000_hotel_reference_currency` and `20261031170000_hr_shared_reference_sources`. No seed/reset, destructive migration, account grant or business-record rewrite.

Encrypted final pre-switch backup: `/opt/rubi/backups/before-develop-409a6fa645-1793513813`. Database dump, documents and private configuration archives were verified by decryption/listing. Original images/Compose are retained for runtime rollback; additive columns are compatible with the former runtime. A prior backup also predates these two migrations.

The first activation stopped before Compose mutation because API and Web shared one image tag; service-specific image replacement corrected the uniqueness assumption. Both migrations were already applied successfully, so subsequent activation verified that exact completed set and did not rerun SQL.

Receipt: `/opt/rubi/call-center-final-rollout-1031/verified.json`. Backup/runtime snapshots and detailed build/test/source evidence remain root-private in that directory. `/opt/rubi/DEPLOYMENT-RECORD.txt` records the publication. About7.4GiB remained after activation. Only this task's unmounted failed staging/failed-build artifacts were cleaned; existing backups and rollback images were preserved.

## Operation scripts

The pinned, reviewed rollout and schema reconciliation commands are retained under `scripts/operations/*1101.py` for audit. They are release-specific, require the separately verified archives/manifests/root-private deployment context, and must not be reused blindly for a newer revision. All runtime switching holds `/opt/rubi/avina-deploy.lock`. Health failure restores original Compose and prior runtime; no automatic destructive database rollback is attempted.
