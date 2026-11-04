ALTER TABLE "hr_records" ADD COLUMN "shared_source_id" UUID;
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_shared_source_id_fkey" FOREIGN KEY ("shared_source_id") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "hr_records_shared_source_id_branch_id_key" ON "hr_records"("shared_source_id", "branch_id");
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_shared_source_not_self" CHECK ("shared_source_id" IS NULL OR "shared_source_id" <> "id");
