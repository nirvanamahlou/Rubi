-- Additive: existing codes, meals, hotel links and activity states are unchanged.
ALTER TABLE "master_meal_services"
  ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "master_meal_services"
  ADD CONSTRAINT "master_meal_services_review_inactive_check"
  CHECK (NOT "isUnderReview" OR NOT "isActive");
