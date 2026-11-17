BEGIN;
ALTER TABLE finance_operational_revisions ADD COLUMN "beneficiaryId" uuid REFERENCES finance_beneficiaries(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE finance_payee_designations (
 id uuid PRIMARY KEY, "bookId" uuid NOT NULL REFERENCES accounting_books(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "ownerId" uuid NOT NULL REFERENCES accounting_details(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "costId" uuid UNIQUE REFERENCES "FinanceTicketPurchaseCostRevision"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "purchaseId" uuid UNIQUE REFERENCES "ReservationServicePurchase"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "operationalId" uuid UNIQUE REFERENCES finance_operational_requests(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdBy" uuid NOT NULL REFERENCES iam_users(id) ON DELETE RESTRICT, "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 CHECK(num_nonnulls("costId","purchaseId","operationalId")=1));
ALTER TABLE finance_broker_transfers ADD FOREIGN KEY ("makerId") REFERENCES iam_users(id) ON DELETE RESTRICT, ADD FOREIGN KEY ("confirmedBy") REFERENCES iam_users(id) ON DELETE RESTRICT;
COMMIT;
