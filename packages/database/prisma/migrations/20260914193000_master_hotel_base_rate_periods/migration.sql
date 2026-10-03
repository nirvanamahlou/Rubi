CREATE TABLE "master_hotel_rate_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branch_id" UUID NOT NULL,
  "city_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "check_in" DATE NOT NULL,
  "check_out" DATE NOT NULL,
  "nights" INTEGER NOT NULL,
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID NOT NULL,
  "create_key" VARCHAR(160) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "master_hotel_rate_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_hotel_rate_period_dates_check" CHECK ("check_out" > "check_in"),
  CONSTRAINT "master_hotel_rate_period_nights_check" CHECK ("nights" > 0),
  CONSTRAINT "master_hotel_rate_period_version_check" CHECK ("current_version" > 0)
);

CREATE TABLE "master_hotel_rate_period_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "city_id_snapshot" UUID NOT NULL,
  "city_name_snapshot" VARCHAR(200) NOT NULL,
  "check_in" DATE NOT NULL,
  "check_out" DATE NOT NULL,
  "nights" INTEGER NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "pricing_basis" VARCHAR(32) NOT NULL DEFAULT 'ROOM_PER_NIGHT',
  "reason" VARCHAR(500) NOT NULL,
  "request_key" VARCHAR(160) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "master_hotel_rate_period_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_hotel_rate_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "master_hotel_rate_version_dates_check" CHECK ("check_out" > "check_in" AND "nights" > 0),
  CONSTRAINT "master_hotel_rate_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "master_hotel_rate_basis_check" CHECK ("pricing_basis" = 'ROOM_PER_NIGHT')
);

CREATE TABLE "master_hotel_base_rate_rows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period_version_id" UUID NOT NULL,
  "hotel_id" UUID NOT NULL,
  "hotel_version" INTEGER NOT NULL,
  "hotel_name_snapshot" VARCHAR(240) NOT NULL,
  "star_rating_snapshot" INTEGER,
  "included" BOOLEAN NOT NULL DEFAULT false,
  "base_amount" DECIMAL(24,4),
  "factors" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "master_hotel_base_rate_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_hotel_base_rate_selected_amount_check" CHECK (("included" AND "base_amount" > 0) OR (NOT "included" AND "base_amount" IS NULL)),
  CONSTRAINT "master_hotel_base_rate_factors_check" CHECK (jsonb_typeof("factors") = 'object'),
  CONSTRAINT "master_hotel_base_rate_hotel_version_check" CHECK ("hotel_version" > 0),
  CONSTRAINT "master_hotel_base_rate_star_check" CHECK ("star_rating_snapshot" IS NULL OR "star_rating_snapshot" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "master_hotel_rate_periods_branch_city_dates_key" ON "master_hotel_rate_periods"("branch_id", "city_id", "check_in", "check_out");
CREATE UNIQUE INDEX "master_hotel_rate_periods_actor_create_key" ON "master_hotel_rate_periods"("created_by_user_id", "create_key");
CREATE INDEX "master_hotel_rate_periods_scope_idx" ON "master_hotel_rate_periods"("branch_id", "city_id", "check_in", "check_out");
CREATE UNIQUE INDEX "master_hotel_rate_period_versions_period_version_key" ON "master_hotel_rate_period_versions"("period_id", "version");
CREATE UNIQUE INDEX "master_hotel_rate_period_versions_actor_request_key" ON "master_hotel_rate_period_versions"("created_by_user_id", "request_key");
CREATE INDEX "master_hotel_rate_period_versions_created_idx" ON "master_hotel_rate_period_versions"("period_id", "created_at");
CREATE UNIQUE INDEX "master_hotel_base_rate_rows_version_hotel_key" ON "master_hotel_base_rate_rows"("period_version_id", "hotel_id");
CREATE INDEX "master_hotel_base_rate_rows_hotel_included_idx" ON "master_hotel_base_rate_rows"("hotel_id", "included");

ALTER TABLE "master_hotel_rate_periods" ADD CONSTRAINT "master_hotel_rate_periods_branch_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_hotel_rate_periods" ADD CONSTRAINT "master_hotel_rate_periods_city_fkey" FOREIGN KEY ("city_id") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_hotel_rate_periods" ADD CONSTRAINT "master_hotel_rate_periods_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_hotel_rate_periods" ADD CONSTRAINT "master_hotel_rate_periods_updated_by_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_hotel_rate_period_versions" ADD CONSTRAINT "master_hotel_rate_period_versions_period_fkey" FOREIGN KEY ("period_id") REFERENCES "master_hotel_rate_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_hotel_rate_period_versions" ADD CONSTRAINT "master_hotel_rate_period_versions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_hotel_base_rate_rows" ADD CONSTRAINT "master_hotel_base_rate_rows_version_fkey" FOREIGN KEY ("period_version_id") REFERENCES "master_hotel_rate_period_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_hotel_base_rate_rows" ADD CONSTRAINT "master_hotel_base_rate_rows_hotel_fkey" FOREIGN KEY ("hotel_id") REFERENCES "master_hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION master_hotel_rate_version_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'MASTER_HOTEL_RATE_VERSION_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "master_hotel_rate_version_no_update"
BEFORE UPDATE OR DELETE ON "master_hotel_rate_period_versions"
FOR EACH ROW EXECUTE FUNCTION master_hotel_rate_version_immutable();

CREATE TRIGGER "master_hotel_rate_row_no_update"
BEFORE UPDATE OR DELETE ON "master_hotel_base_rate_rows"
FOR EACH ROW EXECUTE FUNCTION master_hotel_rate_version_immutable();
