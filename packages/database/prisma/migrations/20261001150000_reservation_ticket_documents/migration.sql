CREATE SEQUENCE reservation_ticket_number_seq AS INTEGER MINVALUE 100000 MAXVALUE 999999 START 100000 NO CYCLE;
CREATE TABLE reservation_ticket_documents (
  id UUID PRIMARY KEY, "intakeId" UUID NOT NULL, "customerId" UUID NOT NULL,
  number VARCHAR(6) NOT NULL UNIQUE CHECK (number ~ '^[0-9]{6}$'),
  source VARCHAR(16) NOT NULL CHECK (source IN ('AUTO','MANUAL')),
  "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "actorUserId" UUID NOT NULL,
  CONSTRAINT "reservation_ticket_documents_intakeId_customerId_key" UNIQUE ("intakeId","customerId"),
  CONSTRAINT "reservation_ticket_documents_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ReservationIntake"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_ticket_documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_ticket_documents_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
