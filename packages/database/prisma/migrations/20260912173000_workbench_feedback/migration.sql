CREATE TYPE "WorkbenchFeedbackDepartment" AS ENUM (
  'FINANCE',
  'RESERVATIONS',
  'SALES',
  'VISA',
  'HUMAN_RESOURCES',
  'MANAGEMENT'
);

CREATE TABLE "workbench_feedback" (
  "id" UUID NOT NULL,
  "tracking_number" VARCHAR(32) NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "branch_id" UUID NOT NULL,
  "department" "WorkbenchFeedbackDepartment" NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "body" VARCHAR(10000) NOT NULL,
  "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
  "attachment_count" INTEGER NOT NULL DEFAULT 0,
  "submitted_by_user_id" UUID NOT NULL,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workbench_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workbench_feedback_attachment_count_check"
    CHECK ("attachment_count" BETWEEN 0 AND 10),
  CONSTRAINT "workbench_feedback_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workbench_feedback_submitted_by_user_id_fkey"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "workbench_feedback_tracking_number_key"
  ON "workbench_feedback"("tracking_number");
CREATE INDEX "workbench_feedback_branch_id_department_submitted_at_idx"
  ON "workbench_feedback"("branch_id", "department", "submitted_at");
CREATE INDEX "workbench_feedback_submitted_by_user_id_submitted_at_idx"
  ON "workbench_feedback"("submitted_by_user_id", "submitted_at");
