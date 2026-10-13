-- Additive only: existing statuses and legacy amenities are preserved.
ALTER TABLE "master_airlines" ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_airlines" ADD CONSTRAINT "master_airlines_review_inactive_check" CHECK (NOT "isUnderReview" OR NOT "isActive");
ALTER TABLE "master_aircraft_types" ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_aircraft_types" ADD CONSTRAINT "master_aircraft_types_review_inactive_check" CHECK (NOT "isUnderReview" OR NOT "isActive");
ALTER TABLE "master_baggage_rules" ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_baggage_rules" ADD CONSTRAINT "master_baggage_rules_review_inactive_check" CHECK (NOT "isUnderReview" OR NOT "isActive");
ALTER TABLE "master_rail_companies" ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_rail_companies" ADD CONSTRAINT "master_rail_companies_review_inactive_check" CHECK (NOT "isUnderReview" OR NOT "isActive");
ALTER TABLE "master_train_types" ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_train_types" ADD CONSTRAINT "master_train_types_review_inactive_check" CHECK (NOT "isUnderReview" OR NOT "isActive");
ALTER TABLE "master_bus_companies" ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_bus_companies" ADD CONSTRAINT "master_bus_companies_review_inactive_check" CHECK (NOT "isUnderReview" OR NOT "isActive");
ALTER TABLE "master_bus_types" ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_bus_types" ADD CONSTRAINT "master_bus_types_review_inactive_check" CHECK (NOT "isUnderReview" OR NOT "isActive");
CREATE TABLE "master_train_type_facilities" (
  "trainTypeId" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,
  CONSTRAINT "master_train_type_facilities_pkey" PRIMARY KEY ("trainTypeId", "facilityId"),
  CONSTRAINT "master_train_type_facilities_trainTypeId_fkey" FOREIGN KEY ("trainTypeId") REFERENCES "master_train_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_train_type_facilities_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "master_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "master_train_type_facilities_facilityId_idx" ON "master_train_type_facilities"("facilityId");
