CREATE TYPE "SalesTripType" AS ENUM ('ONE_WAY', 'ROUND_TRIP');
CREATE TYPE "SalesContractStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SalesReservationStatus" AS ENUM ('NOT_SENT', 'QUEUED', 'ACCEPTED', 'NEEDS_REVIEW', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED');
CREATE TYPE "SalesSettlementStatus" AS ENUM ('UNPAID', 'PARTIALLY_SETTLED', 'SETTLED', 'OVERPAID');
CREATE TYPE "SalesServiceKind" AS ENUM ('FLIGHT', 'HOTEL', 'VISA', 'INSURANCE', 'TRANSFER', 'TOUR', 'BUS', 'TRAIN', 'CIP', 'OTHER');
CREATE TYPE "SalesServiceStatus" AS ENUM ('SELECTED', 'AWAITING_PUBLIC_API', 'NEEDS_RESERVATION_CONFIRMATION');
CREATE TYPE "SalesPassengerAgeCategory" AS ENUM ('ADT', 'CHD', 'INF');
CREATE TYPE "SalesTicketDirection" AS ENUM ('OUTBOUND', 'RETURN');
CREATE TYPE "SalesPriceComponentType" AS ENUM ('BASE', 'DISCOUNT', 'TAX', 'SURCHARGE');
CREATE TYPE "SalesPaymentMethod" AS ENUM ('CASH', 'POS', 'BANK_TRANSFER', 'ONLINE_GATEWAY', 'REMITTANCE', 'CUSTOMER_CREDIT', 'CHECK', 'OTHER');
CREATE TYPE "SalesPaymentStatus" AS ENUM ('SCHEDULED', 'PENDING_FINANCE_CONFIRMATION', 'FINANCE_CONFIRMED', 'FINANCE_REJECTED');
CREATE TYPE "SalesReservationRequestStatus" AS ENUM ('QUEUED', 'ACCEPTED', 'FAILED');
CREATE SEQUENCE "sales_contract_number_seq";

CREATE TABLE "sales_contracts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_number" VARCHAR(40) NOT NULL,
  "branch_id" UUID NOT NULL, "owner_user_id" UUID NOT NULL, "assigned_user_id" UUID,
  "customer_id" UUID NOT NULL, "payer_customer_id" UUID NOT NULL, "customer_name_snapshot" VARCHAR(200) NOT NULL,
  "trip_type" "SalesTripType" NOT NULL, "origin_id" UUID NOT NULL, "destination_id" UUID NOT NULL,
  "departure_date" DATE NOT NULL, "return_not_before" DATE,
  "status" "SalesContractStatus" NOT NULL DEFAULT 'DRAFT', "settlement_status" "SalesSettlementStatus" NOT NULL DEFAULT 'UNPAID',
  "reservation_status" "SalesReservationStatus" NOT NULL DEFAULT 'NOT_SENT',
  "fx_rate" DECIMAL(24,10), "fx_source" VARCHAR(160), "fx_observed_at" TIMESTAMPTZ(3), "pricing_notes" VARCHAR(1000),
  "create_idempotency_key" VARCHAR(160) NOT NULL, "create_request_fingerprint" CHAR(64) NOT NULL,
  "confirm_idempotency_key" VARCHAR(160), "confirm_request_fingerprint" CHAR(64),
  "confirmed_at" TIMESTAMPTZ(3), "cancelled_at" TIMESTAMPTZ(3), "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sales_contracts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_contracts_route_check" CHECK ("origin_id" <> "destination_id"),
  CONSTRAINT "sales_contracts_version_positive_check" CHECK ("version" > 0),
  CONSTRAINT "sales_contracts_return_check" CHECK (("trip_type" = 'ONE_WAY' AND "return_not_before" IS NULL) OR ("trip_type" = 'ROUND_TRIP' AND "return_not_before" >= "departure_date")),
  CONSTRAINT "sales_contracts_fx_bundle_check" CHECK (("fx_rate" IS NULL AND "fx_source" IS NULL AND "fx_observed_at" IS NULL) OR ("fx_rate" > 0 AND "fx_source" IS NOT NULL AND "fx_observed_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "sales_contracts_contract_number_key" ON "sales_contracts"("contract_number");
CREATE UNIQUE INDEX "sales_contracts_owner_user_id_create_idempotency_key_key" ON "sales_contracts"("owner_user_id", "create_idempotency_key");
CREATE UNIQUE INDEX "sales_contracts_owner_user_id_confirm_idempotency_key_key" ON "sales_contracts"("owner_user_id", "confirm_idempotency_key");
CREATE INDEX "sales_contracts_owner_user_id_updated_at_idx" ON "sales_contracts"("owner_user_id", "updated_at");
CREATE INDEX "sales_contracts_assigned_user_id_updated_at_idx" ON "sales_contracts"("assigned_user_id", "updated_at");
CREATE INDEX "sales_contracts_branch_id_status_updated_at_idx" ON "sales_contracts"("branch_id", "status", "updated_at");
CREATE INDEX "sales_contracts_status_settlement_status_reservation_status_idx" ON "sales_contracts"("status", "settlement_status", "reservation_status");
CREATE INDEX "sales_contracts_customer_id_updated_at_idx" ON "sales_contracts"("customer_id", "updated_at");
CREATE INDEX "sales_contracts_departure_date_origin_id_destination_id_idx" ON "sales_contracts"("departure_date", "origin_id", "destination_id");

CREATE TABLE "sales_contract_passengers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "customer_id" UUID NOT NULL,
  "display_name_snapshot" VARCHAR(200) NOT NULL, "birth_date" DATE NOT NULL, "age_category" "SalesPassengerAgeCategory" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "sales_contract_passengers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_contract_passengers_contract_id_customer_id_key" ON "sales_contract_passengers"("contract_id", "customer_id");
CREATE INDEX "sales_contract_passengers_customer_id_idx" ON "sales_contract_passengers"("customer_id");

CREATE TABLE "sales_contract_services" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "client_key" VARCHAR(80) NOT NULL,
  "kind" "SalesServiceKind" NOT NULL, "reference_id" VARCHAR(160), "title_snapshot" VARCHAR(240) NOT NULL,
  "status" "SalesServiceStatus" NOT NULL DEFAULT 'SELECTED', "metadata" JSONB, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_contract_services_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_contract_services_contract_id_client_key_key" ON "sales_contract_services"("contract_id", "client_key");
CREATE INDEX "sales_contract_services_contract_id_kind_idx" ON "sales_contract_services"("contract_id", "kind");

CREATE TABLE "sales_passenger_service_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "passenger_id" UUID NOT NULL, "service_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "sales_passenger_service_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_passenger_service_allocations_passenger_id_service_id_key" ON "sales_passenger_service_allocations"("passenger_id", "service_id");
CREATE INDEX "sales_passenger_service_allocations_service_id_idx" ON "sales_passenger_service_allocations"("service_id");

CREATE TABLE "sales_contract_ticket_selections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "service_id" UUID NOT NULL,
  "direction" "SalesTicketDirection" NOT NULL, "offer_id" VARCHAR(160) NOT NULL, "origin_id" UUID NOT NULL, "destination_id" UUID NOT NULL,
  "departure_at" TIMESTAMPTZ(3) NOT NULL, "arrival_at" TIMESTAMPTZ(3) NOT NULL, "carrier_name_snapshot" VARCHAR(200) NOT NULL,
  "service_number_snapshot" VARCHAR(80) NOT NULL, "cabin_class_code" VARCHAR(80) NOT NULL, "quoted_amount" DECIMAL(20,4) NOT NULL,
  "quoted_currency_code" VARCHAR(3) NOT NULL, "availability_observed_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_contract_ticket_selections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_ticket_time_check" CHECK ("arrival_at" > "departure_at"), CONSTRAINT "sales_ticket_amount_check" CHECK ("quoted_amount" > 0)
);
CREATE UNIQUE INDEX "sales_contract_ticket_selections_contract_id_direction_key" ON "sales_contract_ticket_selections"("contract_id", "direction");
CREATE INDEX "sales_contract_ticket_selections_offer_id_idx" ON "sales_contract_ticket_selections"("offer_id");
CREATE INDEX "sales_contract_ticket_selections_origin_id_destination_id_departure_at_idx" ON "sales_contract_ticket_selections"("origin_id", "destination_id", "departure_at");

CREATE TABLE "sales_contract_hotel_selections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "service_id" UUID NOT NULL, "hotel_id" UUID NOT NULL,
  "hotel_name_snapshot" VARCHAR(240) NOT NULL, "city_id" UUID NOT NULL, "check_in_date" DATE NOT NULL, "check_out_date" DATE NOT NULL,
  "room_count" INTEGER NOT NULL, "room_type_id" UUID NOT NULL, "meal_service_id" UUID, "occupancy" INTEGER NOT NULL,
  "inventory_status" VARCHAR(80) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_contract_hotel_selections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_hotel_dates_check" CHECK ("check_out_date" > "check_in_date"),
  CONSTRAINT "sales_hotel_occupancy_check" CHECK ("room_count" > 0 AND "occupancy" > 0)
);
CREATE UNIQUE INDEX "sales_contract_hotel_selections_contract_id_key" ON "sales_contract_hotel_selections"("contract_id");
CREATE UNIQUE INDEX "sales_contract_hotel_selections_service_id_key" ON "sales_contract_hotel_selections"("service_id");
CREATE INDEX "sales_contract_hotel_selections_hotel_id_check_in_date_idx" ON "sales_contract_hotel_selections"("hotel_id", "check_in_date");

CREATE TABLE "sales_contract_price_components" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "type" "SalesPriceComponentType" NOT NULL,
  "title" VARCHAR(160) NOT NULL, "amount" DECIMAL(20,4) NOT NULL, "currency_code" VARCHAR(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "sales_contract_price_components_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_price_amount_check" CHECK ("amount" > 0), CONSTRAINT "sales_price_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$')
);
CREATE INDEX "sales_contract_price_components_contract_id_currency_code_idx" ON "sales_contract_price_components"("contract_id", "currency_code");

CREATE TABLE "sales_contract_payment_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "amount" DECIMAL(20,4) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL, "due_at" TIMESTAMPTZ(3) NOT NULL, "method" "SalesPaymentMethod" NOT NULL,
  "status" "SalesPaymentStatus" NOT NULL DEFAULT 'PENDING_FINANCE_CONFIRMATION', "description" VARCHAR(500), "payment_reference" VARCHAR(160),
  "bank_id" UUID, "check_secure_identifier" VARCHAR(160), "check_owner_name" VARCHAR(200), "check_due_date" DATE,
  "idempotency_key" VARCHAR(160) NOT NULL, "request_fingerprint" CHAR(64) NOT NULL, "created_by_user_id" UUID NOT NULL,
  "finance_payment_reference" VARCHAR(160), "finance_confirmed_by_ref" VARCHAR(160), "finance_confirmed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sales_contract_payment_entries_pkey" PRIMARY KEY ("id"), CONSTRAINT "sales_payment_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "sales_payment_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "sales_payment_check_bundle_check" CHECK (("method" <> 'CHECK' AND "bank_id" IS NULL AND "check_secure_identifier" IS NULL AND "check_owner_name" IS NULL AND "check_due_date" IS NULL) OR ("method" = 'CHECK' AND "bank_id" IS NOT NULL AND "check_secure_identifier" IS NOT NULL AND "check_owner_name" IS NOT NULL AND "check_due_date" IS NOT NULL))
);
CREATE UNIQUE INDEX "sales_contract_payment_entries_contract_id_idempotency_key_key" ON "sales_contract_payment_entries"("contract_id", "idempotency_key");
CREATE INDEX "sales_contract_payment_entries_contract_id_status_due_at_idx" ON "sales_contract_payment_entries"("contract_id", "status", "due_at");
CREATE INDEX "sales_contract_payment_entries_finance_payment_reference_idx" ON "sales_contract_payment_entries"("finance_payment_reference");

CREATE TABLE "sales_reservation_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "contract_version" INTEGER NOT NULL,
  "request_version" INTEGER NOT NULL DEFAULT 1, "idempotency_key" VARCHAR(160) NOT NULL, "request_fingerprint" CHAR(64) NOT NULL,
  "snapshot" JSONB NOT NULL, "status" "SalesReservationRequestStatus" NOT NULL DEFAULT 'QUEUED', "external_reference" VARCHAR(160),
  "created_by_user_id" UUID NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sales_reservation_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_reservation_requests_contract_id_contract_version_key" ON "sales_reservation_requests"("contract_id", "contract_version");
CREATE UNIQUE INDEX "sales_reservation_requests_contract_id_idempotency_key_key" ON "sales_reservation_requests"("contract_id", "idempotency_key");
CREATE INDEX "sales_reservation_requests_status_created_at_idx" ON "sales_reservation_requests"("status", "created_at");

CREATE TABLE "sales_contract_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "from_status" "SalesContractStatus", "to_status" "SalesContractStatus" NOT NULL,
  "reason" VARCHAR(500) NOT NULL, "changed_by_user_id" UUID NOT NULL, "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_contract_status_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_contract_status_history_contract_id_changed_at_idx" ON "sales_contract_status_history"("contract_id", "changed_at");

CREATE TABLE "sales_contract_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "contract_id" UUID NOT NULL, "actor_user_id" UUID NOT NULL, "actor_branch_id" UUID NOT NULL,
  "action" VARCHAR(120) NOT NULL, "outcome" "AuditOutcome" NOT NULL, "reason" VARCHAR(500), "before_snapshot" JSONB, "after_snapshot" JSONB,
  "trace_id" VARCHAR(160), "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_contract_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_contract_audit_events_contract_id_occurred_at_idx" ON "sales_contract_audit_events"("contract_id", "occurred_at");
CREATE INDEX "sales_contract_audit_events_actor_user_id_occurred_at_idx" ON "sales_contract_audit_events"("actor_user_id", "occurred_at");
CREATE INDEX "sales_contract_audit_events_actor_branch_id_occurred_at_idx" ON "sales_contract_audit_events"("actor_branch_id", "occurred_at");

ALTER TABLE "sales_contract_passengers" ADD CONSTRAINT "sales_contract_passengers_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_contract_services" ADD CONSTRAINT "sales_contract_services_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_passenger_service_allocations" ADD CONSTRAINT "sales_passenger_service_allocations_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "sales_contract_passengers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_passenger_service_allocations" ADD CONSTRAINT "sales_passenger_service_allocations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "sales_contract_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_contract_ticket_selections" ADD CONSTRAINT "sales_contract_ticket_selections_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_contract_ticket_selections" ADD CONSTRAINT "sales_contract_ticket_selections_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "sales_contract_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_contract_hotel_selections" ADD CONSTRAINT "sales_contract_hotel_selections_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_contract_hotel_selections" ADD CONSTRAINT "sales_contract_hotel_selections_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "sales_contract_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_contract_price_components" ADD CONSTRAINT "sales_contract_price_components_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_contract_payment_entries" ADD CONSTRAINT "sales_contract_payment_entries_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_reservation_requests" ADD CONSTRAINT "sales_reservation_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_contract_status_history" ADD CONSTRAINT "sales_contract_status_history_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_contract_audit_events" ADD CONSTRAINT "sales_contract_audit_events_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "sales_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
