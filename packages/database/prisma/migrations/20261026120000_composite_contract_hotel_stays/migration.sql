-- Additive itinerary only. Existing contract hotel/room/price rows are unchanged.
CREATE TABLE "sales_contract_hotel_stays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "hotel_selection_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "hotel_id" UUID NOT NULL,
  "city_id" UUID NOT NULL,
  "hotel_name_snapshot" VARCHAR(240) NOT NULL,
  "check_in_date" DATE NOT NULL,
  "check_out_date" DATE NOT NULL,
  CONSTRAINT "sales_contract_hotel_stays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_contract_hotel_stays_dates_check" CHECK ("check_out_date" > "check_in_date"),
  CONSTRAINT "sales_contract_hotel_stays_ordinal_check" CHECK ("ordinal" BETWEEN 2 AND 50),
  CONSTRAINT "sales_contract_hotel_stays_selection_fkey" FOREIGN KEY ("hotel_selection_id") REFERENCES "sales_contract_hotel_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sales_contract_hotel_stays_hotel_fkey" FOREIGN KEY ("hotel_id") REFERENCES "master_hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sales_contract_hotel_stays_city_fkey" FOREIGN KEY ("city_id") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sales_contract_hotel_stays_hotel_selection_id_ordinal_key" ON "sales_contract_hotel_stays"("hotel_selection_id", "ordinal");
CREATE INDEX "sales_contract_hotel_stays_hotel_id_check_in_date_idx" ON "sales_contract_hotel_stays"("hotel_id", "check_in_date");
CREATE INDEX "sales_contract_hotel_stays_city_id_idx" ON "sales_contract_hotel_stays"("city_id");
