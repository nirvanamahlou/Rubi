# EMPLOYEE-IDENTIFICATION-CODES-1102

Workbook source: کدینگ.xlsx, Sheet1 D2:D3 defines personnel2000001+. Added persisted readonly identificationCode beside personnelCode in employee summary and personnel editor; original personnel code and all IDs retained. Summary uses equal two-column cells with consistent borders/padding and a one-column mobile layout. Optional additive HR output contract; no client input field or permission change.

## Validation

Synthetic SQL fixture/assertions pass for timestamp ties, inactive inclusion, allocation, immutable codes, ordinary edits and deletion non-reuse. Full local DB backup restored to isolated rehearsal DB before applying migration. Both rehearsal and actual18-row local backfills retain the exact hash across all old columns. Assigned2000001..2000018. Only this migration applied and recorded; no unrelated pending migration or production deployment.

Profile, directory, profile-improvement and translation suites checked; one profile rendering test exceeded5s under concurrent build load and passed isolated with20s allowance (no test timeout source changes). API/Web builds and exact-head CI are required before merge. Runtime overlay is limited to changed HR files, schema and contracts and preserves peer changes.

## Deployment

Back up the target and deploy migration20261102170000_employee_identification_codes before matching generated Prisma client/API. Existing server employees receive their own codes by original creation order. Never reset or import local operational rows. Rebuild database/contracts/API and restart; web renders persisted value. Local backup: C:/Users/admin/Rubi-backups/rubi-before-employee-codes-1102.dump (not committed). User explicitly authorized push/develop merge and local3100 activation.
