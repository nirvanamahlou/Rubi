ALTER TABLE "correspondence_deliveries" ADD COLUMN "description" VARCHAR(2000);
DROP INDEX "correspondence_deliveries_senderId_requestKey_key";
CREATE UNIQUE INDEX "correspondence_deliveries_senderId_requestKey_recipientId_key" ON "correspondence_deliveries"("senderId", "requestKey", "recipientId");
