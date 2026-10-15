CREATE TABLE "sales_contract_hotel_rooms" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "hotel_selection_id" UUID NOT NULL,
 "ordinal" INTEGER NOT NULL, "room_type_id" UUID NOT NULL, "room_type_name_snapshot" VARCHAR(240) NOT NULL,
 "adults" INTEGER NOT NULL, "child_ages" JSONB NOT NULL,
 CONSTRAINT "sales_contract_hotel_rooms_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "sales_hotel_room_counts" CHECK ("ordinal" > 0 AND "adults" BETWEEN 1 AND 20 AND jsonb_typeof("child_ages") = 'array'),
 CONSTRAINT "sales_contract_hotel_rooms_hotel_selection_id_fkey" FOREIGN KEY ("hotel_selection_id") REFERENCES "sales_contract_hotel_selections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "sales_contract_hotel_rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "master_room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sales_contract_hotel_rooms_hotel_selection_id_ordinal_key" ON "sales_contract_hotel_rooms"("hotel_selection_id", "ordinal");
CREATE INDEX "sales_contract_hotel_rooms_room_type_id_idx" ON "sales_contract_hotel_rooms"("room_type_id");
