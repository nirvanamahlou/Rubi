# BANK-DETAIL-TITLE-1121 — Bank account detail title

The Accounting detail title for `حساب بانکی` and `حساب‌های بانکی` opens the bank account lookup. Its add action opens the company account form. The bank selector lists the active Master Data directory and can create a native bank record, then select it in the pending account draft. Existing company accounts at the chosen bank can be completed in place. Bank branches and account types can be added in context. The branch code and city follow the selected bank branch.

The bank register accepts the three institution types shown in the reference: bank, financial and credit institution, and Qard Hasan fund. Bank name, bank code, country and institution type are supplied by this form. The form reuses the bank ID, versioned Master Data records and existing creation permission. No seed of bank records is included.

The account form uses the current ledger/company branch and the existing Finance bank-account API. The account title is included as the name used in Nora's account directory. The account number, card and IBAN stay encrypted. Lookups return only masked account numbers and IBANs. A saved or selected account becomes the title source. The eight-digit code is issued only when the separate Accounting detail is saved.

The optional bank account profile stores credit, reserve, materiality, backup account, transfer settings, descriptions, notes and active person signers. Money uses Decimal in the account currency. Backup account and signer links retain native IDs and scope checks. Transfers are not executed by the editor. Profile updates share the account version and transaction, and account creation retries compare the profile as well as the protected identifiers.

The migration adds nullable Master Data fields and two Finance tables with restricted references. It has no backfill or legacy edits. Existing accounts may still be read or edited through the previous API contract. Production activation needs the forward migration with the new API and Web images. Development testing uses disposable PostgreSQL on loopback only.

Verification: 33 API tests, including four real PostgreSQL cases for bank/detail/profile persistence and numbering, and 28 Web tests passed. Scoped lint, API and Web builds, Prisma validation and the additive migration rehearsal passed.

This branch starts at `origin/PC-D-Integration` and fast-forwards to the prerequisite `FIN-CODING-001` branch.
