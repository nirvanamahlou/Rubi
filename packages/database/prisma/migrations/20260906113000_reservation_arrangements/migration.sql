ALTER TABLE "sales_contract_hotel_selections"
ADD COLUMN "single_room_count" INTEGER,
ADD COLUMN "double_room_count" INTEGER,
ADD COLUMN "extra_bed_count" INTEGER;

CREATE TABLE "ReservationArrangementRevision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "intakeId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "roomCount" INTEGER NOT NULL,
    "singleRoomCount" INTEGER NOT NULL,
    "doubleRoomCount" INTEGER NOT NULL,
    "extraBedCount" INTEGER NOT NULL,
    "hotelGuestCustomerIds" JSONB NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationArrangementRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReservationArrangementRevision_counts_check" CHECK (
      "roomCount" > 0 AND "singleRoomCount" >= 0 AND "doubleRoomCount" >= 0 AND
      "extraBedCount" >= 0 AND "singleRoomCount" + "doubleRoomCount" <= "roomCount"
    ),
    CONSTRAINT "ReservationArrangementRevision_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ReservationIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReservationArrangementRevision_intakeId_version_key"
ON "ReservationArrangementRevision"("intakeId", "version");
CREATE INDEX "ReservationArrangementRevision_intakeId_updatedAt_idx"
ON "ReservationArrangementRevision"("intakeId", "updatedAt");
