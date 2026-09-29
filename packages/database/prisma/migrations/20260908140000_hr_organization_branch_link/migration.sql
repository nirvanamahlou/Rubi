-- AlterTable
ALTER TABLE "hr_employees" ADD COLUMN     "organization_branch_id" UUID;

-- CreateIndex
CREATE INDEX "hr_employees_organization_branch_id_branch_id_idx" ON "hr_employees"("organization_branch_id", "branch_id");

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_organization_branch_id_branch_id_fkey" FOREIGN KEY ("organization_branch_id", "branch_id") REFERENCES "hr_records"("id", "branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;
