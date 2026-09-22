CREATE TABLE "reservation_hotel_rate_batches" (
 "id" UUID PRIMARY KEY, "branchId" UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "actorId" UUID NOT NULL REFERENCES iam_users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "requestKey" UUID NOT NULL, "fingerprint" VARCHAR(64) NOT NULL,
 "checkIn" DATE NOT NULL, "checkOut" DATE NOT NULL,
 "currency" VARCHAR(3) NOT NULL CHECK (currency IN ('EUR','USD','IRR')),
 "method" VARCHAR(16) NOT NULL CHECK (method IN ('CHECK_IN','STAY')),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("checkOut">"checkIn")
);
CREATE UNIQUE INDEX "reservation_hotel_rate_batches_actorId_requestKey_key" ON reservation_hotel_rate_batches("actorId","requestKey");
CREATE INDEX "reservation_hotel_rate_batches_branchId_checkIn_checkOut_idx" ON reservation_hotel_rate_batches("branchId","checkIn","checkOut");
CREATE TABLE "reservation_hotel_group_rates" (
 "id" UUID PRIMARY KEY, "batchId" UUID NOT NULL REFERENCES reservation_hotel_rate_batches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "hotelId" UUID NOT NULL REFERENCES master_hotels(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "brokerId" UUID NOT NULL REFERENCES master_organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "hotelName" VARCHAR(300) NOT NULL, "brokerName" VARCHAR(300) NOT NULL,
 "base" DECIMAL(18,2) NOT NULL CHECK(base>0), "factors" JSONB NOT NULL CHECK(jsonb_typeof(factors)='object')
);
CREATE UNIQUE INDEX "reservation_hotel_group_rates_batchId_hotelId_brokerId_key" ON reservation_hotel_group_rates("batchId","hotelId","brokerId");
CREATE INDEX "reservation_hotel_group_rates_hotelId_batchId_idx" ON reservation_hotel_group_rates("hotelId","batchId");
