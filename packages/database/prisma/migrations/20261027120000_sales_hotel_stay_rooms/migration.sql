-- Additive: existing hotel itineraries remain readable without room rows.
CREATE TABLE "sales_contract_hotel_stay_rooms" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "stay_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "room_type_id" uuid NOT NULL,
  "room_type_name_snapshot" varchar(240) NOT NULL,
  "adults" integer NOT NULL,
  "child_ages" jsonb NOT NULL,
  CONSTRAINT "sales_contract_hotel_stay_rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_contract_hotel_stay_rooms_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "sales_contract_hotel_stays"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sales_contract_hotel_stay_rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "master_room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sales_hotel_stay_room_bounds" CHECK ("ordinal" BETWEEN 1 AND 50 AND "adults" BETWEEN 1 AND 20 AND length(trim("room_type_name_snapshot")) > 0),
  CONSTRAINT "sales_hotel_stay_child_array" CHECK (jsonb_typeof("child_ages") = 'array' AND jsonb_array_length("child_ages") <= 20)
);
CREATE UNIQUE INDEX "sales_contract_hotel_stay_rooms_stay_id_ordinal_key" ON "sales_contract_hotel_stay_rooms"("stay_id", "ordinal");
CREATE INDEX "sales_contract_hotel_stay_rooms_room_type_id_idx" ON "sales_contract_hotel_stay_rooms"("room_type_id");
