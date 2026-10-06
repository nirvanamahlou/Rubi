CREATE TABLE "marketing_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "internal_code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "campaign_type" VARCHAR(80) NOT NULL,
    "objective" VARCHAR(1000) NOT NULL,
    "execution_company" VARCHAR(80) NOT NULL,
    "channels" VARCHAR(32)[] NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "segment_id" UUID,
    "sales_target" DECIMAL(24,4) NOT NULL,
    "target_currency_code" VARCHAR(3) NOT NULL,
    "budget_amount" DECIMAL(24,4) NOT NULL,
    "budget_currency_code" VARCHAR(3) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "utm_source" VARCHAR(160),
    "utm_medium" VARCHAR(160),
    "utm_campaign" VARCHAR(160),
    "utm_term" VARCHAR(160),
    "utm_content" VARCHAR(160),
    "frequency_cap" INTEGER NOT NULL,
    "progress_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "links" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "publication_requested_at" TIMESTAMPTZ(3),
    "scheduled_for" TIMESTAMPTZ(3),
    "declared_by_user_id" UUID NOT NULL,
    "declared_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketing_campaign_dates_check" CHECK ("ends_at" > "starts_at"),
    CONSTRAINT "marketing_campaign_amounts_check" CHECK ("sales_target" >= 0 AND "budget_amount" >= 0),
    CONSTRAINT "marketing_campaign_progress_check" CHECK ("progress_percent" >= 0 AND "progress_percent" <= 100),
    CONSTRAINT "marketing_campaign_frequency_check" CHECK ("frequency_cap" > 0),
    CONSTRAINT "marketing_campaign_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'SCHEDULED', 'PAUSED', 'CANCELLED'))
);

CREATE TABLE "marketing_campaign_spend_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "declared_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_campaign_spend_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketing_campaign_spend_amount_check" CHECK ("amount" >= 0)
);

CREATE TABLE "marketing_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "campaign_id" UUID,
    "related_asset_id" UUID,
    "scheduled_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "payload" JSONB NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "marketing_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "marketing_asset_kind_check" CHECK ("kind" IN ('SEGMENT', 'MESSAGE', 'SCHEDULE', 'FORM', 'LANDING_PAGE', 'SHORT_LINK', 'AUTOMATION')),
    CONSTRAINT "marketing_asset_expiry_check" CHECK ("expires_at" IS NULL OR "expires_at" > "created_at")
);

CREATE TABLE "marketing_commands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "entity_type" VARCHAR(32) NOT NULL,
    "result_entity_id" UUID NOT NULL,
    "result_version" INTEGER NOT NULL,
    "payload_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_commands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "entity_type" VARCHAR(32) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "reason" VARCHAR(500),
    "trace_id" VARCHAR(160),
    "version" INTEGER NOT NULL,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_affairs_marketing_intakes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "phone_encrypted" VARCHAR(800) NOT NULL,
    "phone_iv" VARCHAR(64) NOT NULL,
    "phone_auth_tag" VARCHAR(64) NOT NULL,
    "phone_key_version" INTEGER NOT NULL,
    "phone_fingerprint" CHAR(64) NOT NULL,
    "phone_masked" VARCHAR(40) NOT NULL,
    "source_category" VARCHAR(80) NOT NULL,
    "campaign_id" UUID,
    "status" VARCHAR(24) NOT NULL DEFAULT 'NEW',
    "assignee_user_id" UUID,
    "last_follow_up_at" TIMESTAMPTZ(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "score_rule_ids" VARCHAR(80)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(80)[],
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customer_affairs_marketing_intakes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_affairs_marketing_intake_score_check" CHECK ("score" >= 0 AND "score" <= 100),
    CONSTRAINT "customer_affairs_marketing_intake_status_check" CHECK ("status" IN ('NEW', 'CONTACTED', 'QUALIFIED', 'NURTURE', 'LOST'))
);

CREATE UNIQUE INDEX "marketing_campaigns_branch_id_internal_code_key" ON "marketing_campaigns"("branch_id", "internal_code");
CREATE INDEX "marketing_campaigns_branch_id_status_starts_at_ends_at_idx" ON "marketing_campaigns"("branch_id", "status", "starts_at", "ends_at");
CREATE INDEX "marketing_campaigns_branch_id_starts_at_id_idx" ON "marketing_campaigns"("branch_id", "starts_at", "id");
CREATE INDEX "marketing_campaigns_owner_user_id_status_idx" ON "marketing_campaigns"("owner_user_id", "status");
CREATE INDEX "marketing_campaigns_segment_id_idx" ON "marketing_campaigns"("segment_id");
CREATE INDEX "marketing_campaign_spend_lines_campaign_id_idx" ON "marketing_campaign_spend_lines"("campaign_id");
CREATE UNIQUE INDEX "marketing_assets_branch_id_kind_name_key" ON "marketing_assets"("branch_id", "kind", "name");
CREATE INDEX "marketing_assets_branch_id_kind_status_updated_at_idx" ON "marketing_assets"("branch_id", "kind", "status", "updated_at");
CREATE INDEX "marketing_assets_campaign_id_kind_idx" ON "marketing_assets"("campaign_id", "kind");
CREATE INDEX "marketing_assets_related_asset_id_idx" ON "marketing_assets"("related_asset_id");
CREATE UNIQUE INDEX "marketing_commands_actor_user_id_branch_id_operation_idempo_key" ON "marketing_commands"("actor_user_id", "branch_id", "operation", "idempotency_key");
CREATE INDEX "marketing_commands_result_entity_id_idx" ON "marketing_commands"("result_entity_id");
CREATE INDEX "marketing_audit_events_branch_id_occurred_at_idx" ON "marketing_audit_events"("branch_id", "occurred_at");
CREATE INDEX "marketing_audit_events_entity_type_entity_id_occurred_at_idx" ON "marketing_audit_events"("entity_type", "entity_id", "occurred_at");
CREATE UNIQUE INDEX "customer_affairs_marketing_intakes_branch_id_phone_fingerpr_key" ON "customer_affairs_marketing_intakes"("branch_id", "phone_fingerprint");
CREATE INDEX "customer_affairs_marketing_intakes_branch_id_source_categor_idx" ON "customer_affairs_marketing_intakes"("branch_id", "source_category", "created_at");
CREATE INDEX "customer_affairs_marketing_intakes_branch_id_created_at_id_idx" ON "customer_affairs_marketing_intakes"("branch_id", "created_at", "id");
CREATE INDEX "customer_affairs_marketing_intakes_campaign_id_created_at_idx" ON "customer_affairs_marketing_intakes"("campaign_id", "created_at");
CREATE INDEX "customer_affairs_marketing_intakes_assignee_user_id_status__idx" ON "customer_affairs_marketing_intakes"("assignee_user_id", "status", "last_follow_up_at");

ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_declared_by_user_id_fkey" FOREIGN KEY ("declared_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_campaign_spend_lines" ADD CONSTRAINT "marketing_campaign_spend_lines_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_related_asset_id_fkey" FOREIGN KEY ("related_asset_id") REFERENCES "marketing_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "marketing_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_commands" ADD CONSTRAINT "marketing_commands_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_commands" ADD CONSTRAINT "marketing_commands_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_audit_events" ADD CONSTRAINT "marketing_audit_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_audit_events" ADD CONSTRAINT "marketing_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_marketing_intakes" ADD CONSTRAINT "customer_affairs_marketing_intakes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_marketing_intakes" ADD CONSTRAINT "customer_affairs_marketing_intakes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_marketing_intakes" ADD CONSTRAINT "customer_affairs_marketing_intakes_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_marketing_intakes" ADD CONSTRAINT "customer_affairs_marketing_intakes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_marketing_intakes" ADD CONSTRAINT "customer_affairs_marketing_intakes_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
