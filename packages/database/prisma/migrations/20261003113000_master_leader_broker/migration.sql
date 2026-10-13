ALTER TABLE "master_leaders" ADD COLUMN "brokerId" UUID;

ALTER TABLE "master_leaders"
  ADD CONSTRAINT "master_leaders_brokerId_fkey"
  FOREIGN KEY ("brokerId") REFERENCES "master_brokers"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "master_leaders_brokerId_isActive_name_idx"
  ON "master_leaders"("brokerId", "isActive", "name");
