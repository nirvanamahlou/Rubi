-- Keep the IAM actor for authorization while identifying the actual HR employee.
ALTER TABLE "hr_employees"
  ADD CONSTRAINT "hr_employees_id_branch_id_key" UNIQUE ("id", "branch_id");

ALTER TABLE "procurement_request"
  ADD COLUMN "requesterEmployeeId" UUID;

ALTER TABLE "procurement_request"
  ADD CONSTRAINT "procurement_request_requester_employee_branch_fkey"
  FOREIGN KEY ("requesterEmployeeId", "branchId")
  REFERENCES "hr_employees" ("id", "branch_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "procurement_request_requesterEmployeeId_branchId_idx"
  ON "procurement_request" ("requesterEmployeeId", "branchId");
