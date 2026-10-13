CREATE TABLE "reservation_hotel_rate_pack_sources" (
    "packId" UUID NOT NULL,
    "sourceBatchId" UUID NOT NULL,
    CONSTRAINT "reservation_hotel_rate_pack_sources_pkey" PRIMARY KEY ("packId", "sourceBatchId")
);
CREATE INDEX "reservation_hotel_rate_pack_sources_sourceBatchId_idx" ON "reservation_hotel_rate_pack_sources"("sourceBatchId");
ALTER TABLE "reservation_hotel_rate_pack_sources" ADD CONSTRAINT "reservation_hotel_rate_pack_sources_packId_fkey" FOREIGN KEY ("packId") REFERENCES "reservation_hotel_rate_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_hotel_rate_pack_sources" ADD CONSTRAINT "reservation_hotel_rate_pack_sources_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "reservation_hotel_rate_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
