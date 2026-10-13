ALTER TABLE "master_brokers"
 ADD COLUMN "boardText" VARCHAR(300),
 ADD COLUMN "primaryPhoneEncrypted" TEXT,
 ADD COLUMN "primaryPhoneEncryptionIv" VARCHAR(24),
 ADD COLUMN "primaryPhoneEncryptionAuthTag" VARCHAR(24),
 ADD COLUMN "primaryPhoneEncryptionKeyVersion" INTEGER,
 ADD COLUMN "primaryPhoneMasked" VARCHAR(80),
 ADD COLUMN "primaryPhoneFingerprint" CHAR(64);
CREATE TABLE "master_broker_cities" (
 "brokerId" UUID NOT NULL,
 "cityId" UUID NOT NULL,
 CONSTRAINT "master_broker_cities_pkey" PRIMARY KEY ("brokerId", "cityId"),
 CONSTRAINT "master_broker_cities_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "master_brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "master_broker_cities_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "master_broker_cities_cityId_idx" ON "master_broker_cities"("cityId");
INSERT INTO "master_broker_cities" ("brokerId", "cityId") SELECT "id", "cityId" FROM "master_brokers" WHERE "cityId" IS NOT NULL;
