SET lock_timeout = '15s';
ALTER TABLE "ReservationHotelPurchase"
  DROP CONSTRAINT "ReservationHotelPurchase_amount_check",
  ADD CONSTRAINT "ReservationHotelPurchase_amount_check"
    CHECK ("amount" >= 0 AND "amount"::text NOT IN ('NaN', 'Infinity', '-Infinity'));
ALTER TABLE "ReservationServicePurchase"
  DROP CONSTRAINT "ReservationServicePurchase_amount_check",
  ADD CONSTRAINT "ReservationServicePurchase_amount_check"
    CHECK ("amount"::text NOT IN ('NaN', 'Infinity', '-Infinity') AND
      ("amount" > 0 OR ("amount" = 0 AND "serviceKind" IN ('HOTEL', 'TRANSFER'))));
RESET lock_timeout;
