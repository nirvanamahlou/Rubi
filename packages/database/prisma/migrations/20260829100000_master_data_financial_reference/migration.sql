CREATE TYPE "MasterCurrencyDisplayPolicy" AS ENUM (
  'SYMBOL_BEFORE',
  'SYMBOL_AFTER',
  'CODE_BEFORE',
  'CODE_AFTER'
);

CREATE TYPE "MasterPaymentMethodChannel" AS ENUM (
  'CASH',
  'POS',
  'BANK_TRANSFER',
  'ONLINE_GATEWAY',
  'CREDIT',
  'WALLET',
  'OTHER'
);

CREATE TYPE "MasterPaymentMethodDirection" AS ENUM (
  'RECEIPT',
  'PAYMENT',
  'BOTH'
);

ALTER TABLE "master_currencies"
  ADD COLUMN "displayPolicy" "MasterCurrencyDisplayPolicy" NOT NULL DEFAULT 'CODE_AFTER';

ALTER TABLE "master_banks"
  ADD COLUMN "englishName" VARCHAR(160),
  ADD COLUMN "swiftCode" VARCHAR(11);

CREATE UNIQUE INDEX "master_banks_swiftCode_key"
  ON "master_banks"("swiftCode")
  WHERE "swiftCode" IS NOT NULL;

ALTER TABLE "master_banks"
  ADD CONSTRAINT "master_bank_swift_format" CHECK (
    "swiftCode" IS NULL OR "swiftCode" ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'
  );

CREATE TABLE "master_bank_branches" (
  "id" UUID NOT NULL,
  "bankId" UUID NOT NULL,
  "cityId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "address" VARCHAR(500),
  "phone" VARCHAR(32),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_bank_branches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_bank_branch_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  CONSTRAINT "master_bank_branches_bankId_fkey" FOREIGN KEY ("bankId")
    REFERENCES "master_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_bank_branches_cityId_fkey" FOREIGN KEY ("cityId")
    REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "master_bank_branches_bankId_code_key"
  ON "master_bank_branches"("bankId", "code");
CREATE INDEX "master_bank_branches_bankId_isActive_name_idx"
  ON "master_bank_branches"("bankId", "isActive", "name");
CREATE INDEX "master_bank_branches_cityId_isActive_name_idx"
  ON "master_bank_branches"("cityId", "isActive", "name");

CREATE TABLE "master_payment_methods" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "description" VARCHAR(500),
  "channel" "MasterPaymentMethodChannel" NOT NULL,
  "direction" "MasterPaymentMethodDirection" NOT NULL DEFAULT 'BOTH',
  "requiresManualApproval" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_payment_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_payment_method_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  CONSTRAINT "master_payment_method_display_order_non_negative" CHECK ("displayOrder" >= 0)
);

CREATE UNIQUE INDEX "master_payment_methods_code_key"
  ON "master_payment_methods"("code");
CREATE INDEX "master_payment_methods_isActive_displayOrder_name_idx"
  ON "master_payment_methods"("isActive", "displayOrder", "name");
CREATE INDEX "master_payment_methods_channel_direction_isActive_idx"
  ON "master_payment_methods"("channel", "direction", "isActive");
