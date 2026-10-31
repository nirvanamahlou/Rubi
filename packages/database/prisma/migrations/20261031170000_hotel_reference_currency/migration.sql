ALTER TABLE "master_hotels" ADD COLUMN "currencyId" UUID;
CREATE INDEX "master_hotels_currencyId_idx" ON "master_hotels"("currencyId");
ALTER TABLE "master_hotels" ADD CONSTRAINT "master_hotels_currencyId_fkey"
  FOREIGN KEY ("currencyId") REFERENCES "master_currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
