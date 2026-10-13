CREATE TABLE "sales_contract_passenger_prices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "passenger_id" UUID NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "amount" DECIMAL(24,4) NOT NULL,
  CONSTRAINT "sales_contract_passenger_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_passenger_price_nonnegative" CHECK ("amount" >= 0),
  CONSTRAINT "sales_passenger_price_currency" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "sales_contract_passenger_prices_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "sales_contract_passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "sales_contract_passenger_prices_passenger_id_currency_code_key" ON "sales_contract_passenger_prices"("passenger_id", "currency_code");
