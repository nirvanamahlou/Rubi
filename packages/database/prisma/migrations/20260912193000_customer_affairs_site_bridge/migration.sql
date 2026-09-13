CREATE TABLE "customer_affairs_sites" (
  "id" UUID PRIMARY KEY,
  "code" VARCHAR(48) NOT NULL UNIQUE,
  "domain" VARCHAR(160) NOT NULL UNIQUE
);
CREATE TABLE "customer_affairs_site_tickets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_id" UUID NOT NULL REFERENCES "customer_affairs_sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "ticket_id" UUID NOT NULL UNIQUE REFERENCES "customer_affairs_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "external_id" VARCHAR(160) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_affairs_site_tickets_site_id_external_id_key" UNIQUE ("site_id", "external_id")
);
INSERT INTO "customer_affairs_sites" ("id", "code", "domain") VALUES
('e7b2cb0a-4454-4e4d-8200-000000000001', 'jahanbastan', 'jahanbastan.ir'),
('e7b2cb0a-4454-4e4d-8200-000000000002', 'nystkt', 'nystkt.ir');
