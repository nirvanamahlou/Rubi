-- Optional association only: existing accounts and permissions remain unchanged.
ALTER TABLE "iam_user_profiles" ADD COLUMN "organization_unit_id" UUID;
CREATE INDEX "iam_user_profiles_organization_unit_id_idx" ON "iam_user_profiles"("organization_unit_id");
ALTER TABLE "iam_user_profiles" ADD CONSTRAINT "iam_user_profiles_organization_unit_id_fkey"
  FOREIGN KEY ("organization_unit_id") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
