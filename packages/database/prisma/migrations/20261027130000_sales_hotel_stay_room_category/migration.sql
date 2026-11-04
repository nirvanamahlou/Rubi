ALTER TABLE "sales_contract_hotel_stay_rooms"
  ADD COLUMN "room_category" VARCHAR(16);

ALTER TABLE "sales_contract_hotel_stay_rooms"
  ADD CONSTRAINT "sales_hotel_stay_room_category_check"
  CHECK ("room_category" IS NULL OR "room_category" IN ('SINGLE', 'DOUBLE', 'DOUBLE_EXTRA', 'TRIPLE', 'FAMILY'));
