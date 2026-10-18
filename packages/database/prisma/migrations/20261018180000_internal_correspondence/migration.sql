CREATE TABLE "correspondence_letters" (
  "id" UUID NOT NULL, "authorId" UUID NOT NULL, "number" VARCHAR(100) NOT NULL,
  "dateISO" VARCHAR(10) NOT NULL, "content" JSONB NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "correspondence_letters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "correspondence_letters_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "correspondence_letters_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "correspondence_letters_number_key" ON "correspondence_letters"("number");
CREATE INDEX "correspondence_letters_authorId_createdAt_idx" ON "correspondence_letters"("authorId", "createdAt");
CREATE TABLE "correspondence_deliveries" (
  "id" UUID NOT NULL, "letterId" UUID NOT NULL, "senderId" UUID NOT NULL, "recipientId" UUID NOT NULL,
  "status" VARCHAR(24) NOT NULL, "requestKey" UUID NOT NULL, "readAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "correspondence_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "correspondence_deliveries_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "correspondence_letters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "correspondence_deliveries_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "correspondence_deliveries_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "correspondence_deliveries_status_check" CHECK ("status" IN ('SENT','APPROVED','REJECTED','NEEDS_CORRECTION'))
);
CREATE UNIQUE INDEX "correspondence_deliveries_senderId_requestKey_key" ON "correspondence_deliveries"("senderId", "requestKey");
CREATE UNIQUE INDEX "correspondence_deliveries_letterId_recipientId_key" ON "correspondence_deliveries"("letterId", "recipientId");
CREATE INDEX "correspondence_deliveries_recipientId_createdAt_idx" ON "correspondence_deliveries"("recipientId", "createdAt");
CREATE INDEX "correspondence_deliveries_letterId_recipientId_idx" ON "correspondence_deliveries"("letterId", "recipientId");
