CREATE TABLE "website_contract_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "receiptNumber" BIGSERIAL NOT NULL UNIQUE,
    "attempt" CHAR(40) NOT NULL UNIQUE,
    "customerName" VARCHAR(150) NOT NULL,
    "contractNumber" VARCHAR(40) NOT NULL,
    "amountRial" DECIMAL(18,0) NOT NULL CHECK ("amountRial" > 0),
    "terminalId" VARCHAR(24) NOT NULL,
    "bankReference" VARCHAR(100) NOT NULL,
    "trackingNumber" VARCHAR(100) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_contract_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "website_contract_payment_bank_key" UNIQUE ("terminalId", "bankReference")
);

CREATE INDEX "website_contract_payment_branch_verified_idx"
    ON "website_contract_payments" ("branchId", "verifiedAt");
