CREATE SEQUENCE master_hotel_identification_number_seq AS bigint;

SELECT setval(
  'master_hotel_identification_number_seq',
  COALESCE(MAX(substring(trim("identificationCode") from '(?i)^HTL-[A-Z]{3}-([0-9]{1,18})$')::bigint), 0) + 1,
  false
)
FROM master_hotels;
