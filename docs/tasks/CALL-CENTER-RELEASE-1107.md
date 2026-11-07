# Call Center release closeout — PC-C — 2026-11-07

The owner authorized fixing and merging the open Amin-tech11 PRs, then publishing the remaining Call Center changes. PR1397, PR1406, PR1407 and PR1419 were integrated and merged only after every current-head hosted check succeeded. PR1429 and PR1430 were also merged. Source and migration checks on final develop `7000f7b1b280e0366b38a5a2e24a94679494663d` succeeded.

## Backup authorization and runtime

Publication was held for disk capacity. The owner subsequently authorized retirement of only these old complete backup directories under `/opt/rubi/backups`:

- `before-develop-1c9724aa-initial-1793704608`
- `before-develop-caa86475-initial-1793771763`
- `before-develop-be30af10e-initial-1793787837`

The retained complete backup passed SHA256, decryption and archive/database-list checks again before retirement. Only those three directories were removed; documents, original recordings and newer backups were retained. The retirement receipt is `/opt/rubi/call-center-final-release-1105/backup-retirement.json`.

A concurrent deployment held the shared `/opt/rubi/avina-deploy.lock` while building the same final develop revision. This task stopped only its own waiting duplicate build, preserved the peer process and reused its successful exact-version API/Web/Worker rollout. Independent verification then matched all177 relevant Call Center, Issabel and notification source files. Existing Finance changes are included in the same final develop source. No unrelated peer process was stopped or source rewritten by this task.

Applied migrations:

- `20261105110000_call_center_request_review`
- `20261105111000_call_center_wrong_number_outcome`

The existing runtime database role can select/insert/update the review table; its four foreign keys and acknowledgement-pair check exist. The call outcome constraint accepts the already-supported `WRONG_NUMBER` result. No new permission grants were needed.

## Validation and historical correction

All four hosted gates passed for the released develop revision. Focused checks in the actual runtime image passed71 API and38 Web cases. Thirteen opt-in PostgreSQL cases were intentionally skipped in that network-isolated runtime invocation; the hosted PostgreSQL migration/test gate was already green.

An encrypted database backup was created and its restore listing verified before running the existing preview-first completion reconciliation. Preview identified exactly four saved terminal calls whose optional identity fields had incorrectly kept their derived completion flags open. Apply repaired exactly four through the existing audited transaction helper. A second preview found no remaining eligible repair. Unsaved, active and genuinely incomplete records were skipped. Call facts and caller identity were not synthesized; this repair does not create historical request-review receipts.

Post-release checks passed for HTTPS login/health, static assets, API/Web/Worker running state and zero restart counters, authenticated Worker pending requests, recent AMI connection and the recording timer. This validates deployed source and operational connectivity; it is not a claim that a new human inbound/outbound call was placed during closeout.

Protected server evidence:

- `/opt/rubi/server-develop-7000f7b1b-1107/verified.json`
- `/opt/rubi/call-center-final-release-1105/final-call-center-verification.json`
- `/opt/rubi/call-center-final-release-1105/completion-repair-verified.json`
- `/opt/rubi/DEPLOYMENT-RECORD.txt`

These receipts retain only the necessary operational evidence on the server. Credentials, caller details and recording contents are not in this repository. This documentation closeout requires no additional application deployment.
