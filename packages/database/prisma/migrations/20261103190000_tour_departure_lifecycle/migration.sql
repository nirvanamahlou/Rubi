ALTER TABLE "TourDeparture" ADD COLUMN "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "lifecycleVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TourDeparture" ADD CONSTRAINT "tour_departure_status_check" CHECK ("status" IN ('ACTIVE','PAUSED','DELETED') AND "lifecycleVersion" >= 0);
CREATE TABLE "TourDepartureLifecycleRevision" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "departureId" UUID NOT NULL REFERENCES "TourDeparture"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "version" INTEGER NOT NULL CHECK ("version" > 0), "status" VARCHAR(16) NOT NULL CHECK ("status" IN ('ACTIVE','PAUSED','DELETED')),
 "actorUserId" UUID NOT NULL REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TourDepartureLifecycleRevision_departureId_version_key" UNIQUE ("departureId","version")
);
