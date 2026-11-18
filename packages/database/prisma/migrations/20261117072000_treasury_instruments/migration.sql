CREATE TABLE "treasury_instruments" (
  "id" UUID PRIMARY KEY REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "bookId" UUID NOT NULL REFERENCES accounting_books(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "providerId" UUID, "receivingBankId" UUID REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "operatorId" UUID,"merchantNumber" VARCHAR(80),"terminalNumber" VARCHAR(80),"deviceType" VARCHAR(32),"titleEn" VARCHAR(160),
  location VARCHAR(240),description VARCHAR(2000),"descriptionEn" VARCHAR(2000),
  FOREIGN KEY ("providerId","bookId") REFERENCES accounting_configurations(id,"bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("operatorId","bookId") REFERENCES accounting_details(id,"bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK (("deviceType" IS NULL AND "operatorId" IS NOT NULL AND "providerId" IS NULL AND "receivingBankId" IS NULL AND "merchantNumber" IS NULL AND "terminalNumber" IS NULL)
    OR ("deviceType" IN ('کارت خوان','موبایل','اینترنت') AND "deviceType" IS NOT NULL AND "providerId" IS NOT NULL AND "receivingBankId" IS NOT NULL AND "merchantNumber" IS NOT NULL AND "terminalNumber" IS NOT NULL)),
  UNIQUE("id","bookId"), UNIQUE("bookId","providerId","merchantNumber","terminalNumber")
);
CREATE INDEX "treasury_instruments_receivingBankId_idx" ON treasury_instruments("receivingBankId");
CREATE TABLE "treasury_cashier_assignments" (
  id UUID PRIMARY KEY,"instrumentId" UUID NOT NULL,"bookId" UUID NOT NULL,"cashierId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL,"endsAt" TIMESTAMPTZ(3),CHECK("endsAt" IS NULL OR "endsAt">="startsAt"),
  FOREIGN KEY ("instrumentId","bookId") REFERENCES treasury_instruments(id,"bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("cashierId","bookId") REFERENCES accounting_details(id,"bookId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "treasury_cashier_assignments_instrumentId_startsAt_idx" ON treasury_cashier_assignments("instrumentId","startsAt");
CREATE UNIQUE INDEX "treasury_one_current_cashier" ON treasury_cashier_assignments("instrumentId") WHERE "endsAt" IS NULL;
