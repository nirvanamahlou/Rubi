ALTER TABLE "sales_contract_hotel_rooms" DROP CONSTRAINT "sales_room_category_valid";
ALTER TABLE "sales_contract_hotel_rooms" ADD CONSTRAINT "sales_room_category_valid" CHECK ("room_category" IS NULL OR "room_category" IN ('SINGLE','DOUBLE','DOUBLE_EXTRA','TRIPLE','FAMILY'));
