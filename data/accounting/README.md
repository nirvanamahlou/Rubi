# Accounting reference data

`rahkaran-chart-737.json` contains the 222 observed chart accounts and 26 observed
detail-type definitions already transferred to Rubi. It preserves stable identities,
parent relationships and detail-level assignments. Operational amounts, journals,
users, credentials and source screenshots are excluded.

Validate the package offline:

```powershell
node apps/api/scripts/accounting-reference-data.mjs --validate
```

For another local Rubi installation, supply the existing authorized user's credentials
and branch through `ACCOUNTING_SEED_USERNAME`, `ACCOUNTING_SEED_PASSWORD` and
`ACCOUNTING_SEED_BRANCH_ID`. Set `ACCOUNTING_SEED_API` to its local `/api/v1/` URL.
Run the script with `--preview` before `--apply`. Credentials are read from process
environment only and never printed or written. The script uses normal public IAM and
Finance APIs, checks branch access and existing data before writing, refuses collisions
or divergent records, and uses stable idempotency keys. Re-running on the existing
Rubi reference book is a verified no-op.

Synthetic journals used by PostgreSQL tests remain reproducible in
`apps/api/test/accounting.postgres.spec.ts`; they are not live financial records.
Database backups and accounting-only operational archives stay outside Git so IAM
password hashes, tokens and other modules' data are never included in a code push.
