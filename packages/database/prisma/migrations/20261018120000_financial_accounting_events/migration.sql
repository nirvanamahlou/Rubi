-- CreateTable
CREATE TABLE "finance_accounting_events" (
    "id" UUID NOT NULL,
    "sourceKey" VARCHAR(200) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "source" VARCHAR(24) NOT NULL,
    "recordId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "kind" VARCHAR(48) NOT NULL,
    "branchId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "settlementAccountId" UUID,
    "partyId" VARCHAR(160),
    "reference" VARCHAR(160),
    "journalId" UUID,
    "lastError" VARCHAR(1000),
    "attemptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_accounting_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounting_events_sourceKey_key" ON "finance_accounting_events"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounting_events_journalId_key" ON "finance_accounting_events"("journalId");

-- CreateIndex
CREATE INDEX "finance_accounting_events_branchId_journalId_createdAt_idx" ON "finance_accounting_events"("branchId", "journalId", "createdAt");

-- AddForeignKey
ALTER TABLE "finance_accounting_events" ADD CONSTRAINT "finance_accounting_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_accounting_events" ADD CONSTRAINT "finance_accounting_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_accounting_events" ADD CONSTRAINT "finance_accounting_events_settlementAccountId_fkey" FOREIGN KEY ("settlementAccountId") REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_accounting_events" ADD CONSTRAINT "finance_accounting_events_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "accounting_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE finance_accounting_events ADD CONSTRAINT finance_event_positive CHECK (amount > 0);
ALTER TABLE finance_accounting_events ADD CONSTRAINT finance_event_currency CHECK (currency ~ '^[A-Z]{3}$');
-- Source facts cannot be rewritten after business confirmation, even by another producer.
CREATE FUNCTION guard_financial_event_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Financial source events cannot be deleted'; END IF;
  IF (to_jsonb(NEW) - ARRAY['journalId','lastError','attemptedAt']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['journalId','lastError','attemptedAt']) THEN
    RAISE EXCEPTION 'Financial source event is immutable';
  END IF;
  IF OLD."journalId" IS NOT NULL AND NEW."journalId" IS DISTINCT FROM OLD."journalId" THEN
    RAISE EXCEPTION 'Financial journal association is immutable';
  END IF;
  IF NEW."journalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM accounting_journals j JOIN accounting_books b ON b.id=j."bookId"
    WHERE j.id=NEW."journalId" AND b."branchId"=NEW."branchId" AND j."sourceKey"=NEW."sourceKey"
  ) THEN RAISE EXCEPTION 'Financial journal must match source and branch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER financial_event_immutable BEFORE UPDATE OR DELETE ON finance_accounting_events
FOR EACH ROW EXECUTE FUNCTION guard_financial_event_immutable();
