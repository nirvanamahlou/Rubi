ALTER TABLE "FinanceSettlementAccount"
  ADD COLUMN "bankIdentifiers" JSONB,
  ADD COLUMN "maskedAccountNumber" VARCHAR(40),
  ADD COLUMN "maskedCardNumber" VARCHAR(24),
  ADD COLUMN "maskedIban" VARCHAR(40),
  ADD COLUMN "accountFingerprint" VARCHAR(64),
  ADD COLUMN "cardFingerprint" VARCHAR(64),
  ADD COLUMN "ibanFingerprint" VARCHAR(64);

ALTER TABLE "FinanceSettlementAccount" ADD CONSTRAINT "FinanceBankAccount_protected_shape_check" CHECK (
  "bankIdentifiers" IS NULL OR (
    "kind" = 'BANK' AND "bankId" IS NOT NULL AND jsonb_typeof("bankIdentifiers") = 'object'
    AND "bankIdentifiers" @> '{"version": 1}'::jsonb
    AND "bankIdentifiers" ?& ARRAY['nonce', 'tag', 'ciphertext']
    AND jsonb_typeof("bankIdentifiers"->'nonce') = 'string'
    AND jsonb_typeof("bankIdentifiers"->'tag') = 'string'
    AND jsonb_typeof("bankIdentifiers"->'ciphertext') = 'string'
    AND ("accountFingerprint" IS NOT NULL OR "cardFingerprint" IS NOT NULL OR "ibanFingerprint" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "FinanceBankAccount_account_key" ON "FinanceSettlementAccount"("branchId", "bankId", "accountFingerprint");
CREATE UNIQUE INDEX "FinanceBankAccount_card_key" ON "FinanceSettlementAccount"("branchId", "bankId", "cardFingerprint");
CREATE UNIQUE INDEX "FinanceBankAccount_iban_key" ON "FinanceSettlementAccount"("branchId", "bankId", "ibanFingerprint");

CREATE TABLE "FinanceBankAccountAudit" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "action" VARCHAR(24) NOT NULL,
  "metadata" JSONB NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceBankAccountAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceBankAccountAudit_action_check" CHECK ("action" IN ('CREATE', 'UPDATE', 'REVEAL')),
  CONSTRAINT "FinanceBankAccountAudit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceBankAccountAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FinanceBankAccountAudit_accountId_occurredAt_idx" ON "FinanceBankAccountAudit"("accountId", "occurredAt");
CREATE INDEX "FinanceBankAccountAudit_actorUserId_occurredAt_idx" ON "FinanceBankAccountAudit"("actorUserId", "occurredAt");

CREATE FUNCTION finance_bank_account_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Finance bank account audit is append-only';
END;
$$;
CREATE TRIGGER finance_bank_account_audit_immutable BEFORE UPDATE OR DELETE ON "FinanceBankAccountAudit"
FOR EACH ROW EXECUTE FUNCTION finance_bank_account_audit_immutable();
