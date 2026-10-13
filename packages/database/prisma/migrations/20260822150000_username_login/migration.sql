ALTER TABLE "iam_users" ADD COLUMN "username" VARCHAR(80);

-- Existing accounts receive a deterministic collision-free technical username.
-- An administrator can replace it with the assigned username after deployment.
UPDATE "iam_users"
SET "username" = 'user-' || replace("id"::text, '-', '')
WHERE "username" IS NULL;

ALTER TABLE "iam_users" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "iam_users" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "iam_users_username_key" ON "iam_users"("username");
