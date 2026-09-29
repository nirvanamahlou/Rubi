BEGIN;
ALTER TABLE "b2b_agreement_revisions"
  ADD COLUMN "paymentMethodId" UUID,
  ADD COLUMN "paymentMethodName" VARCHAR(160),
  ADD CONSTRAINT "b2b_agreement_revisions_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "master_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "b2b_agreement_revisions" DROP CONSTRAINT "b2b_revision_terms_check";
ALTER TABLE "b2b_agreement_revisions" ADD CONSTRAINT "b2b_revision_terms_check" CHECK (
  "number" > 0 AND length(trim("title")) >= 2 AND length(trim("changeReason")) >= 3
  AND ("endsAt" IS NULL OR "endsAt" >= "startsAt")
  AND cardinality("currencyCodes") BETWEEN 1 AND 12 AND cardinality("services") BETWEEN 1 AND 8
  AND "agreementType" IN ('FRAMEWORK','AGENCY','CORPORATE','FLIGHT_SALES','HOTEL_SERVICES','TOUR_SERVICES','VISA_SERVICES','TRANSPORT_SERVICES','COMMISSION','SERVICE_LEVEL','OTHER')
  AND "paymentMethod" IN ('PREPAID','CREDIT','MIXED')
  AND "settlementCycle" IN ('PER_ORDER','WEEKLY','MONTHLY','CUSTOM')
  AND "settlementDays" BETWEEN 0 AND 365
  AND ("cutoffDay" IS NULL OR "cutoffDay" BETWEEN 1 AND 28)
  AND ("slaHours" IS NULL OR "slaHours" BETWEEN 1 AND 720)
);
COMMIT;
