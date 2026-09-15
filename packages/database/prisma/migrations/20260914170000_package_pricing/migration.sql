-- PACKAGE-PRICING-001: additive, module-owned persistence only.
CREATE TYPE "PackagePricingStatus" AS ENUM ('DRAFT','READY_FOR_REVIEW','APPROVED','PUBLISHED','STOPPED','EXPIRED','ARCHIVED');
CREATE TYPE "PackagePricingComponentKind" AS ENUM ('OUTBOUND_TICKET','RETURN_TICKET','HOTEL','VISA','INSURANCE','TRANSFER','TOUR','LEADER','OTHER');
CREATE TYPE "PackagePricingRuleOperation" AS ENUM ('ADD_FIXED','SUBTRACT_FIXED','ADD_PERCENT','SUBTRACT_PERCENT','MULTIPLY','DIVIDE','FEE','COMMISSION','TAX','PROFIT','ROUND','MINIMUM_PROFIT','MINIMUM_SALE_PRICE');
CREATE TYPE "PackagePricingPassengerCategory" AS ENUM ('ADULT','CHILD_WITH_BED','CHILD_WITHOUT_BED','INFANT','SINGLE_ROOM','DOUBLE_ROOM','TRIPLE_ROOM');
CREATE TYPE "PackagePricingVersionStatus" AS ENUM ('DRAFT','READY_FOR_REVIEW','PUBLISHED','STOPPED');
CREATE TYPE "PackagePricingQuoteStatus" AS ENUM ('DRAFT','APPROVED','CONVERTED_TO_CONTRACT','EXPIRED','CANCELLED');
CREATE TYPE "PackagePricingBannerFormat" AS ENUM ('SQUARE_POST','STORY','HORIZONTAL','WEBSITE','A4');
CREATE TYPE "PackagePricingRenderStatus" AS ENUM ('AWAITING_RENDERER','QUEUED','PROCESSING','COMPLETED','FAILED');

CREATE TABLE "package_pricing_packages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branch_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "title_fa" VARCHAR(200) NOT NULL,
  "title_en" VARCHAR(200) NOT NULL,
  "issuer_legal_entity_id" UUID NOT NULL,
  "issuer_legal_entity_version" INTEGER NOT NULL,
  "destination_id" UUID NOT NULL,
  "destination_name_snapshot" VARCHAR(200) NOT NULL,
  "status" "PackagePricingStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID NOT NULL,
  "create_idempotency_key" VARCHAR(160) NOT NULL,
  "create_request_fingerprint" CHAR(64) NOT NULL,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "package_pricing_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_package_positive_version" CHECK ("version" > 0 AND "issuer_legal_entity_version" > 0)
);

CREATE TABLE "package_pricing_departures" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "package_id" UUID NOT NULL,
  "departure_date" DATE NOT NULL,
  "return_date" DATE NOT NULL,
  "nights" INTEGER NOT NULL,
  "days" INTEGER NOT NULL,
  "capacity" INTEGER NOT NULL,
  "price_valid_until" TIMESTAMPTZ(3) NOT NULL,
  "description" VARCHAR(2000),
  "terms" VARCHAR(4000),
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "package_pricing_departures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_departure_dates" CHECK ("return_date" > "departure_date"),
  CONSTRAINT "package_pricing_departure_counts" CHECK ("nights" > 0 AND "days" > 0 AND "capacity" > 0 AND "version" > 0)
);

CREATE TABLE "package_pricing_components" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "departure_id" UUID NOT NULL,
  "client_key" VARCHAR(80) NOT NULL,
  "kind" "PackagePricingComponentKind" NOT NULL,
  "source_owner" VARCHAR(40) NOT NULL,
  "source_kind" VARCHAR(80) NOT NULL,
  "source_reference_id" UUID NOT NULL,
  "source_reference_version" INTEGER NOT NULL,
  "title_snapshot" VARCHAR(240) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "capacity" INTEGER,
  "source_base_amount" DECIMAL(24,4),
  "source_currency_code" VARCHAR(3),
  "source_observed_at" TIMESTAMPTZ(3),
  "source_snapshot" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_pricing_components_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_component_values" CHECK ("quantity" > 0 AND "source_reference_version" > 0 AND ("capacity" IS NULL OR "capacity" >= 0) AND ("source_base_amount" IS NULL OR "source_base_amount" > 0)),
  CONSTRAINT "package_pricing_component_currency" CHECK (("source_base_amount" IS NULL AND "source_currency_code" IS NULL) OR ("source_base_amount" IS NOT NULL AND "source_currency_code" ~ '^[A-Z]{3}$'))
);

CREATE TABLE "package_pricing_hotel_options" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "departure_id" UUID NOT NULL,
  "hotel_reference_id" UUID NOT NULL,
  "hotel_reference_version" INTEGER NOT NULL,
  "hotel_name_snapshot" VARCHAR(200) NOT NULL,
  "room_type_reference_id" UUID NOT NULL,
  "room_type_reference_version" INTEGER NOT NULL,
  "room_type_name_snapshot" VARCHAR(160) NOT NULL,
  "meal_service_reference_id" UUID NOT NULL,
  "meal_service_reference_version" INTEGER NOT NULL,
  "meal_service_name_snapshot" VARCHAR(160) NOT NULL,
  "check_in_date" DATE NOT NULL,
  "check_out_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_pricing_hotel_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_hotel_dates" CHECK ("check_out_date" > "check_in_date"),
  CONSTRAINT "package_pricing_hotel_versions" CHECK ("hotel_reference_version" > 0 AND "room_type_reference_version" > 0 AND "meal_service_reference_version" > 0)
);

CREATE TABLE "package_pricing_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "departure_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "valid_from" TIMESTAMPTZ(3) NOT NULL,
  "valid_to" TIMESTAMPTZ(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_pricing_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_period_dates" CHECK ("valid_to" > "valid_from" AND "version" > 0)
);

CREATE TABLE "package_pricing_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "period_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "operation" "PackagePricingRuleOperation" NOT NULL,
  "value" DECIMAL(24,10) NOT NULL,
  "applies_to_component_key" VARCHAR(80),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_pricing_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_rule_values" CHECK ("version" > 0 AND "sequence" > 0 AND "value" >= 0),
  CONSTRAINT "package_pricing_rule_divisor" CHECK ("operation" <> 'DIVIDE' OR "value" > 0)
);

CREATE TABLE "package_pricing_price_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "departure_id" UUID NOT NULL,
  "period_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PackagePricingVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "currency_code" VARCHAR(3) NOT NULL,
  "base_amount" DECIMAL(24,4) NOT NULL,
  "adjustment_amount" DECIMAL(24,4) NOT NULL,
  "fee_amount" DECIMAL(24,4) NOT NULL,
  "tax_amount" DECIMAL(24,4) NOT NULL,
  "profit_amount" DECIMAL(24,4) NOT NULL,
  "final_amount" DECIMAL(24,4) NOT NULL,
  "margin_percent" DECIMAL(12,6) NOT NULL,
  "minimum_profit_amount" DECIMAL(24,4),
  "minimum_sale_amount" DECIMAL(24,4),
  "source_snapshot" JSONB NOT NULL,
  "rule_snapshot" JSONB NOT NULL,
  "breakdown" JSONB NOT NULL,
  "fx_snapshot" JSONB,
  "created_by_user_id" UUID NOT NULL,
  "reviewed_by_user_id" UUID,
  "published_at" TIMESTAMPTZ(3),
  "reason" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_pricing_price_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_price_values" CHECK ("version" > 0 AND "base_amount" > 0 AND "final_amount" > 0 AND "currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "package_pricing_publish_metadata" CHECK (("status" = 'PUBLISHED' AND "published_at" IS NOT NULL AND "reviewed_by_user_id" IS NOT NULL) OR "status" <> 'PUBLISHED')
);

CREATE TABLE "package_pricing_passenger_prices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "price_version_id" UUID NOT NULL,
  "category" "PackagePricingPassengerCategory" NOT NULL,
  "amount" DECIMAL(24,4) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  CONSTRAINT "package_pricing_passenger_prices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_passenger_price_positive" CHECK ("amount" > 0 AND "currency_code" ~ '^[A-Z]{3}$')
);

CREATE TABLE "package_pricing_quotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branch_id" UUID NOT NULL,
  "package_id" UUID NOT NULL,
  "departure_id" UUID NOT NULL,
  "price_version_id" UUID NOT NULL,
  "customer_reference" UUID,
  "agency_reference" UUID,
  "status" "PackagePricingQuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "passenger_counts" JSONB NOT NULL,
  "subtotal_amount" DECIMAL(24,4) NOT NULL,
  "discount_amount" DECIMAL(24,4) NOT NULL,
  "final_amount" DECIMAL(24,4) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "valid_until" TIMESTAMPTZ(3) NOT NULL,
  "notes" VARCHAR(2000),
  "sales_contract_reference" UUID,
  "created_by_user_id" UUID NOT NULL,
  "create_idempotency_key" VARCHAR(160) NOT NULL,
  "create_request_fingerprint" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "package_pricing_quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_quote_amounts" CHECK ("version" > 0 AND "subtotal_amount" > 0 AND "discount_amount" >= 0 AND "final_amount" > 0 AND "discount_amount" <= "subtotal_amount" AND "currency_code" ~ '^[A-Z]{3}$')
);

CREATE TABLE "package_pricing_quote_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "quote_id" UUID NOT NULL,
  "category" "PackagePricingPassengerCategory" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_amount" DECIMAL(24,4) NOT NULL,
  "total_amount" DECIMAL(24,4) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  CONSTRAINT "package_pricing_quote_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_quote_item_amounts" CHECK ("quantity" > 0 AND "unit_amount" > 0 AND "total_amount" > 0 AND "currency_code" ~ '^[A-Z]{3}$')
);

CREATE TABLE "package_pricing_banner_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branch_id" UUID NOT NULL,
  "issuer_legal_entity_id" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "format" "PackagePricingBannerFormat" NOT NULL,
  "version" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "template_definition" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_pricing_banner_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_template_dimensions" CHECK ("version" > 0 AND "width" > 0 AND "height" > 0)
);

CREATE TABLE "package_pricing_render_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branch_id" UUID NOT NULL,
  "package_id" UUID NOT NULL,
  "departure_id" UUID NOT NULL,
  "price_version_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "template_version" INTEGER NOT NULL,
  "branding_snapshot_id" UUID NOT NULL,
  "branding_snapshot_version" INTEGER NOT NULL,
  "output_format" VARCHAR(8) NOT NULL,
  "status" "PackagePricingRenderStatus" NOT NULL DEFAULT 'AWAITING_RENDERER',
  "output_document_reference" UUID,
  "failure_code" VARCHAR(80),
  "created_by_user_id" UUID NOT NULL,
  "create_idempotency_key" VARCHAR(160) NOT NULL,
  "create_request_fingerprint" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "package_pricing_render_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_render_versions" CHECK ("template_version" > 0 AND "branding_snapshot_version" > 0),
  CONSTRAINT "package_pricing_render_format" CHECK ("output_format" IN ('PNG','JPEG','PDF')),
  CONSTRAINT "package_pricing_render_output" CHECK (("status" = 'COMPLETED' AND "output_document_reference" IS NOT NULL) OR "status" <> 'COMPLETED')
);

CREATE TABLE "package_pricing_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "package_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "actor_branch_id" UUID NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "outcome" "AuditOutcome" NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" UUID NOT NULL,
  "entity_version" INTEGER NOT NULL,
  "reason" VARCHAR(500),
  "before_snapshot" JSONB,
  "after_snapshot" JSONB,
  "trace_id" VARCHAR(160),
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_pricing_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "package_pricing_audit_version" CHECK ("entity_version" > 0)
);

CREATE UNIQUE INDEX "package_pricing_packages_branch_id_code_key" ON "package_pricing_packages"("branch_id","code");
CREATE UNIQUE INDEX "package_pricing_packages_created_by_user_id_create_idempotency_key_key" ON "package_pricing_packages"("created_by_user_id","create_idempotency_key");
CREATE INDEX "package_pricing_packages_branch_id_status_updated_at_idx" ON "package_pricing_packages"("branch_id","status","updated_at");
CREATE INDEX "package_pricing_packages_destination_id_status_idx" ON "package_pricing_packages"("destination_id","status");
CREATE UNIQUE INDEX "package_pricing_departures_package_id_departure_date_key" ON "package_pricing_departures"("package_id","departure_date");
CREATE INDEX "package_pricing_departures_departure_date_return_date_idx" ON "package_pricing_departures"("departure_date","return_date");
CREATE UNIQUE INDEX "package_pricing_components_departure_id_client_key_key" ON "package_pricing_components"("departure_id","client_key");
CREATE INDEX "package_pricing_components_source_owner_source_kind_source_reference_id_idx" ON "package_pricing_components"("source_owner","source_kind","source_reference_id");
CREATE UNIQUE INDEX "package_pricing_hotel_options_departure_hotel_room_meal_key" ON "package_pricing_hotel_options"("departure_id","hotel_reference_id","room_type_reference_id","meal_service_reference_id");
CREATE INDEX "package_pricing_hotel_options_hotel_dates_idx" ON "package_pricing_hotel_options"("hotel_reference_id","check_in_date","check_out_date");
CREATE INDEX "package_pricing_periods_departure_id_valid_from_valid_to_idx" ON "package_pricing_periods"("departure_id","valid_from","valid_to");
CREATE UNIQUE INDEX "package_pricing_rules_period_id_version_sequence_key" ON "package_pricing_rules"("period_id","version","sequence");
CREATE INDEX "package_pricing_rules_period_id_version_idx" ON "package_pricing_rules"("period_id","version");
CREATE UNIQUE INDEX "package_pricing_price_versions_departure_id_version_key" ON "package_pricing_price_versions"("departure_id","version");
CREATE INDEX "package_pricing_price_versions_departure_id_status_created_at_idx" ON "package_pricing_price_versions"("departure_id","status","created_at");
CREATE INDEX "package_pricing_price_versions_period_id_created_at_idx" ON "package_pricing_price_versions"("period_id","created_at");
CREATE UNIQUE INDEX "package_pricing_passenger_prices_price_version_id_category_key" ON "package_pricing_passenger_prices"("price_version_id","category");
CREATE UNIQUE INDEX "package_pricing_quotes_created_by_user_id_create_idempotency_key_key" ON "package_pricing_quotes"("created_by_user_id","create_idempotency_key");
CREATE INDEX "package_pricing_quotes_branch_id_status_created_at_idx" ON "package_pricing_quotes"("branch_id","status","created_at");
CREATE INDEX "package_pricing_quotes_package_id_departure_id_idx" ON "package_pricing_quotes"("package_id","departure_id");
CREATE UNIQUE INDEX "package_pricing_quote_items_quote_id_category_key" ON "package_pricing_quote_items"("quote_id","category");
CREATE UNIQUE INDEX "package_pricing_banner_templates_branch_id_code_version_key" ON "package_pricing_banner_templates"("branch_id","code","version");
CREATE INDEX "package_pricing_banner_templates_issuer_format_active_idx" ON "package_pricing_banner_templates"("issuer_legal_entity_id","format","is_active");
CREATE UNIQUE INDEX "package_pricing_render_requests_created_by_user_id_create_idempotency_key_key" ON "package_pricing_render_requests"("created_by_user_id","create_idempotency_key");
CREATE INDEX "package_pricing_render_requests_branch_id_status_created_at_idx" ON "package_pricing_render_requests"("branch_id","status","created_at");
CREATE INDEX "package_pricing_render_requests_package_id_price_version_id_idx" ON "package_pricing_render_requests"("package_id","price_version_id");
CREATE INDEX "package_pricing_audit_events_package_id_occurred_at_idx" ON "package_pricing_audit_events"("package_id","occurred_at");
CREATE INDEX "package_pricing_audit_events_actor_user_id_occurred_at_idx" ON "package_pricing_audit_events"("actor_user_id","occurred_at");
CREATE INDEX "package_pricing_audit_events_actor_branch_id_occurred_at_idx" ON "package_pricing_audit_events"("actor_branch_id","occurred_at");

ALTER TABLE "package_pricing_departures" ADD CONSTRAINT "package_pricing_departures_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "package_pricing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_components" ADD CONSTRAINT "package_pricing_components_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "package_pricing_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_hotel_options" ADD CONSTRAINT "package_pricing_hotel_options_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "package_pricing_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_periods" ADD CONSTRAINT "package_pricing_periods_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "package_pricing_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_rules" ADD CONSTRAINT "package_pricing_rules_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "package_pricing_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_price_versions" ADD CONSTRAINT "package_pricing_price_versions_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "package_pricing_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_price_versions" ADD CONSTRAINT "package_pricing_price_versions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "package_pricing_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_passenger_prices" ADD CONSTRAINT "package_pricing_passenger_prices_price_version_id_fkey" FOREIGN KEY ("price_version_id") REFERENCES "package_pricing_price_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_quotes" ADD CONSTRAINT "package_pricing_quotes_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "package_pricing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_quotes" ADD CONSTRAINT "package_pricing_quotes_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "package_pricing_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_quotes" ADD CONSTRAINT "package_pricing_quotes_price_version_id_fkey" FOREIGN KEY ("price_version_id") REFERENCES "package_pricing_price_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_quote_items" ADD CONSTRAINT "package_pricing_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "package_pricing_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_render_requests" ADD CONSTRAINT "package_pricing_render_requests_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "package_pricing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_render_requests" ADD CONSTRAINT "package_pricing_render_requests_departure_id_fkey" FOREIGN KEY ("departure_id") REFERENCES "package_pricing_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_render_requests" ADD CONSTRAINT "package_pricing_render_requests_price_version_id_fkey" FOREIGN KEY ("price_version_id") REFERENCES "package_pricing_price_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_render_requests" ADD CONSTRAINT "package_pricing_render_requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "package_pricing_banner_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "package_pricing_audit_events" ADD CONSTRAINT "package_pricing_audit_events_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "package_pricing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION package_pricing_reject_immutable_price() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'PUBLISHED_PRICE_IMMUTABLE';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "package_pricing_price_immutable_update"
BEFORE UPDATE ON "package_pricing_price_versions"
FOR EACH ROW EXECUTE FUNCTION package_pricing_reject_immutable_price();

CREATE TRIGGER "package_pricing_price_immutable_delete"
BEFORE DELETE ON "package_pricing_price_versions"
FOR EACH ROW EXECUTE FUNCTION package_pricing_reject_immutable_price();
