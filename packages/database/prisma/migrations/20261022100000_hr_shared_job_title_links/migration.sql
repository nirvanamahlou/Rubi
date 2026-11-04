-- Shared HR job titles have independent FKs; branch-scoped ordinary parent links remain unchanged.
SET lock_timeout = '10s';
ALTER TABLE "hr_employees" ADD COLUMN "job_title_id" UUID;
ALTER TABLE "hr_records" ADD COLUMN "job_title_id" UUID;
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "hr_employees_job_title_id_idx" ON "hr_employees"("job_title_id");
CREATE INDEX "hr_records_job_title_id_idx" ON "hr_records"("job_title_id");
RESET lock_timeout;
