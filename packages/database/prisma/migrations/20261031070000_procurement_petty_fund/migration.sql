-- CreateTable
CREATE TABLE "procurement_petty_funds" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "custodianId" UUID NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "balance" DECIMAL(24,4) NOT NULL,
    "bankName" VARCHAR(120) NOT NULL DEFAULT '',
    "accountNumber" VARCHAR(40) NOT NULL DEFAULT '',
    "iban" VARCHAR(34) NOT NULL DEFAULT '',
    "cardNumber" VARCHAR(20) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "procurement_petty_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_petty_entries" (
    "requestId" UUID,
    "id" UUID NOT NULL,
    "fundId" UUID NOT NULL,
    "requestKey" UUID,
    "amount" DECIMAL(24,4) NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_petty_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procurement_petty_funds_branchId_key" ON "procurement_petty_funds"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_petty_entries_requestKey_key" ON "procurement_petty_entries"("requestKey");

-- CreateIndex
CREATE INDEX "procurement_petty_entries_fundId_createdAt_idx" ON "procurement_petty_entries"("fundId", "createdAt");

-- AddForeignKey
ALTER TABLE "procurement_petty_funds" ADD CONSTRAINT "procurement_petty_funds_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_petty_funds" ADD CONSTRAINT "procurement_petty_funds_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_petty_entries" ADD CONSTRAINT "procurement_petty_entries_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_petty_entries" ADD CONSTRAINT "procurement_petty_entries_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_petty_entries" ADD CONSTRAINT "procurement_petty_entries_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "procurement_petty_funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "procurement_petty_funds" ADD CONSTRAINT "procurement_petty_balance_nonnegative" CHECK (balance >= 0);
CREATE FUNCTION procurement_petty_entry_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."requestId" IS NULL AND OLD."requestId" IS NOT NULL AND (to_jsonb(NEW) - 'requestId') = (to_jsonb(OLD) - 'requestId') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Petty cash movements are immutable';
END;
$$;
CREATE TRIGGER procurement_petty_entry_immutable BEFORE UPDATE OR DELETE ON "procurement_petty_entries" FOR EACH ROW EXECUTE FUNCTION procurement_petty_entry_immutable();
