BEGIN;
ALTER TABLE "FinanceSettlementAccount" DROP CONSTRAINT "FinanceBankAccount_protected_shape_check";
ALTER TABLE "FinanceSettlementAccount" ADD CONSTRAINT "FinanceBankAccount_protected_shape_check" CHECK (
  "bankIdentifiers" IS NULL OR (
    "kind" = 'BANK' AND "bankId" IS NOT NULL AND jsonb_typeof("bankIdentifiers") = 'object'
    AND "bankIdentifiers" @> '{"version": 1}'::jsonb
    AND "bankIdentifiers" ?& ARRAY['nonce', 'tag', 'ciphertext']
    AND jsonb_typeof("bankIdentifiers"->'nonce') = 'string'
    AND jsonb_typeof("bankIdentifiers"->'tag') = 'string'
    AND jsonb_typeof("bankIdentifiers"->'ciphertext') = 'string'
    AND ("isExternal" OR "accountFingerprint" IS NOT NULL OR "cardFingerprint" IS NOT NULL OR "ibanFingerprint" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "FinanceBankAccount_external_account_key" ON "FinanceSettlementAccount" ("bankId", "accountFingerprint") WHERE "branchId" IS NULL AND "accountFingerprint" IS NOT NULL;
CREATE UNIQUE INDEX "FinanceBankAccount_external_card_key" ON "FinanceSettlementAccount" ("bankId", "cardFingerprint") WHERE "branchId" IS NULL AND "cardFingerprint" IS NOT NULL;
CREATE UNIQUE INDEX "FinanceBankAccount_external_iban_key" ON "FinanceSettlementAccount" ("bankId", "ibanFingerprint") WHERE "branchId" IS NULL AND "ibanFingerprint" IS NOT NULL;
COMMIT;
