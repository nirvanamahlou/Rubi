CREATE TABLE "customer_affairs_leads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tracking_number" VARCHAR(32) NOT NULL,
  "branch_id" UUID NOT NULL, "customer_id" UUID, "title" VARCHAR(200) NOT NULL,
  "source_reference" VARCHAR(160) NOT NULL, "inbound_channel" VARCHAR(32) NOT NULL,
  "contact_occurred_at" TIMESTAMPTZ(3) NOT NULL, "travel_need" VARCHAR(1000) NOT NULL,
  "origin_reference" VARCHAR(160), "destination_reference" VARCHAR(160),
  "travel_start" TIMESTAMPTZ(3), "travel_end" TIMESTAMPTZ(3),
  "date_precision" VARCHAR(24) NOT NULL DEFAULT 'UNKNOWN', "date_flexibility" VARCHAR(240),
  "passenger_count" INTEGER NOT NULL, "passenger_composition" JSONB NOT NULL,
  "requested_services" JSONB NOT NULL, "budget_minimum" DECIMAL(24,4),
  "budget_maximum" DECIMAL(24,4), "currency_code" VARCHAR(3), "budget_basis" VARCHAR(32),
  "budget_unknown_reason" VARCHAR(500), "special_preferences" VARCHAR(1000),
  "contact_fingerprint" CHAR(64), "priority" VARCHAR(16) NOT NULL,
  "assignee_user_id" UUID, "queue_code" VARCHAR(80), "next_action" VARCHAR(500) NOT NULL,
  "next_action_at" TIMESTAMPTZ(3) NOT NULL, "stage" VARCHAR(32) NOT NULL DEFAULT 'NEW',
  "qualification" JSONB, "lost_reason" VARCHAR(80), "lost_note" VARCHAR(500),
  "created_by_user_id" UUID NOT NULL, "updated_by_user_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_affairs_leads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_affairs_leads_assignment_check" CHECK ("assignee_user_id" IS NOT NULL OR "queue_code" IS NOT NULL),
  CONSTRAINT "customer_affairs_leads_passenger_check" CHECK ("passenger_count" > 0),
  CONSTRAINT "customer_affairs_leads_budget_check" CHECK (("budget_minimum" IS NULL OR "budget_minimum" >= 0) AND ("budget_maximum" IS NULL OR "budget_maximum" >= COALESCE("budget_minimum", 0))),
  CONSTRAINT "customer_affairs_leads_currency_check" CHECK (("budget_minimum" IS NULL AND "budget_maximum" IS NULL) OR "currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "customer_affairs_leads_stage_check" CHECK ("stage" IN ('NEW','CONTACTED','QUALIFYING','NURTURE','QUALIFIED','HANDOFF_PROPOSED','HANDED_OFF','LOST')),
  CONSTRAINT "customer_affairs_leads_priority_check" CHECK ("priority" IN ('LOW','NORMAL','HIGH','URGENT'))
);
CREATE UNIQUE INDEX "customer_affairs_leads_tracking_number_key" ON "customer_affairs_leads"("tracking_number");
CREATE UNIQUE INDEX "customer_affairs_leads_branch_id_source_reference_key" ON "customer_affairs_leads"("branch_id", "source_reference");
CREATE INDEX "customer_affairs_leads_branch_id_stage_next_action_at_idx" ON "customer_affairs_leads"("branch_id", "stage", "next_action_at");
CREATE INDEX "customer_affairs_leads_assignee_user_id_stage_next_action_a_idx" ON "customer_affairs_leads"("assignee_user_id", "stage", "next_action_at");
CREATE INDEX "customer_affairs_leads_contact_fingerprint_created_at_idx" ON "customer_affairs_leads"("contact_fingerprint", "created_at");
CREATE INDEX "customer_affairs_leads_customer_id_created_at_idx" ON "customer_affairs_leads"("customer_id", "created_at");

CREATE TABLE "customer_affairs_tickets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tracking_number" VARCHAR(32) NOT NULL,
  "branch_id" UUID NOT NULL, "customer_id" UUID, "subject" VARCHAR(200) NOT NULL,
  "description" VARCHAR(2000) NOT NULL, "channel" VARCHAR(32) NOT NULL,
  "contact_occurred_at" TIMESTAMPTZ(3) NOT NULL, "category" VARCHAR(48) NOT NULL,
  "service_type" VARCHAR(80), "impact" VARCHAR(16) NOT NULL, "urgency" VARCHAR(16) NOT NULL,
  "priority" VARCHAR(16) NOT NULL, "status" VARCHAR(32) NOT NULL DEFAULT 'NEW',
  "customer_owner_user_id" UUID NOT NULL, "execution_owner_user_id" UUID,
  "execution_unit" VARCHAR(80), "references" JSONB NOT NULL,
  "sla_policy_version" VARCHAR(80) NOT NULL, "first_response_due_at" TIMESTAMPTZ(3) NOT NULL,
  "resolution_due_at" TIMESTAMPTZ(3) NOT NULL, "first_responded_at" TIMESTAMPTZ(3),
  "resolved_at" TIMESTAMPTZ(3), "paused_at" TIMESTAMPTZ(3), "paused_minutes" INTEGER NOT NULL DEFAULT 0,
  "first_response_breached_at" TIMESTAMPTZ(3), "resolution_breached_at" TIMESTAMPTZ(3),
  "escalation_level" INTEGER, "next_action" VARCHAR(500) NOT NULL, "next_action_at" TIMESTAMPTZ(3) NOT NULL,
  "resolution_outcome" VARCHAR(1000), "close_reason" VARCHAR(500), "closed_at" TIMESTAMPTZ(3),
  "reopen_count" INTEGER NOT NULL DEFAULT 0, "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_affairs_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_affairs_tickets_priority_check" CHECK ("priority" IN ('LOW','NORMAL','HIGH','URGENT','CRITICAL')),
  CONSTRAINT "customer_affairs_tickets_status_check" CHECK ("status" IN ('NEW','TRIAGED','IN_PROGRESS','WAITING_CUSTOMER','WAITING_EXTERNAL','RESOLVED','CLOSED','REOPENED','CANCELLED')),
  CONSTRAINT "customer_affairs_tickets_escalation_check" CHECK ("escalation_level" IS NULL OR "escalation_level" BETWEEN 1 AND 3),
  CONSTRAINT "customer_affairs_tickets_sla_order_check" CHECK ("resolution_due_at" > "first_response_due_at")
);
CREATE UNIQUE INDEX "customer_affairs_tickets_tracking_number_key" ON "customer_affairs_tickets"("tracking_number");
CREATE INDEX "customer_affairs_tickets_branch_id_status_priority_updated__idx" ON "customer_affairs_tickets"("branch_id", "status", "priority", "updated_at");
CREATE INDEX "customer_affairs_tickets_customer_owner_user_id_status_next_idx" ON "customer_affairs_tickets"("customer_owner_user_id", "status", "next_action_at");
CREATE INDEX "customer_affairs_tickets_execution_owner_user_id_status_nex_idx" ON "customer_affairs_tickets"("execution_owner_user_id", "status", "next_action_at");
CREATE INDEX "customer_affairs_tickets_customer_id_created_at_idx" ON "customer_affairs_tickets"("customer_id", "created_at");
CREATE INDEX "customer_affairs_tickets_first_response_due_at_resolution_d_idx" ON "customer_affairs_tickets"("first_response_due_at", "resolution_due_at");

CREATE TABLE "customer_affairs_timeline" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "lead_id" UUID, "ticket_id" UUID,
  "type" VARCHAR(48) NOT NULL, "outcome" VARCHAR(80), "summary" VARCHAR(2000) NOT NULL,
  "customer_visible" BOOLEAN NOT NULL DEFAULT false, "channel" VARCHAR(32),
  "recipient_reference" VARCHAR(160), "template_version" VARCHAR(80), "delivery_status" VARCHAR(24),
  "delivery_key" VARCHAR(160), "document_version_ids" UUID[], "actor_user_id" UUID NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_affairs_timeline_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_affairs_timeline_parent_check" CHECK (("lead_id" IS NOT NULL)::int + ("ticket_id" IS NOT NULL)::int = 1),
  CONSTRAINT "customer_affairs_timeline_delivery_check" CHECK ("delivery_status" IS NULL OR "delivery_status" IN ('PENDING','DELIVERED','FAILED'))
);
CREATE UNIQUE INDEX "customer_affairs_timeline_delivery_key_key" ON "customer_affairs_timeline"("delivery_key");
CREATE INDEX "customer_affairs_timeline_lead_id_occurred_at_idx" ON "customer_affairs_timeline"("lead_id", "occurred_at");
CREATE INDEX "customer_affairs_timeline_ticket_id_occurred_at_idx" ON "customer_affairs_timeline"("ticket_id", "occurred_at");

CREATE TABLE "customer_affairs_handoffs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "lead_id" UUID NOT NULL, "package_version" INTEGER NOT NULL,
  "idempotency_key" VARCHAR(160) NOT NULL, "request_fingerprint" CHAR(64) NOT NULL,
  "payload_snapshot" JSONB NOT NULL, "status" VARCHAR(32) NOT NULL DEFAULT 'WAITING_SALES',
  "sales_contract_id" UUID, "response_reason" VARCHAR(500), "dispatched_at" TIMESTAMPTZ(3),
  "responded_at" TIMESTAMPTZ(3), "created_by_user_id" UUID NOT NULL, "responded_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_affairs_handoffs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_affairs_handoffs_status_check" CHECK ("status" IN ('WAITING_SALES','ACCEPTED','RETURNED','REJECTED')),
  CONSTRAINT "customer_affairs_handoffs_acceptance_check" CHECK ("status" <> 'ACCEPTED' OR "sales_contract_id" IS NOT NULL)
);
CREATE UNIQUE INDEX "customer_affairs_handoffs_lead_id_package_version_key" ON "customer_affairs_handoffs"("lead_id", "package_version");
CREATE UNIQUE INDEX "customer_affairs_handoffs_lead_id_idempotency_key_key" ON "customer_affairs_handoffs"("lead_id", "idempotency_key");
CREATE INDEX "customer_affairs_handoffs_status_created_at_idx" ON "customer_affairs_handoffs"("status", "created_at");
CREATE INDEX "customer_affairs_handoffs_sales_contract_id_idx" ON "customer_affairs_handoffs"("sales_contract_id");

CREATE TABLE "customer_affairs_referrals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "ticket_id" UUID NOT NULL,
  "destination_module" VARCHAR(80) NOT NULL, "destination_unit" VARCHAR(80), "assigned_user_id" UUID,
  "title" VARCHAR(200) NOT NULL, "description" VARCHAR(1000) NOT NULL, "due_at" TIMESTAMPTZ(3) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN', "response_summary" VARCHAR(1000),
  "idempotency_key" VARCHAR(160) NOT NULL, "request_fingerprint" CHAR(64) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "responded_by_user_id" UUID, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "customer_affairs_referrals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_affairs_referrals_status_check" CHECK ("status" IN ('OPEN','IN_PROGRESS','DONE','CANCELLED'))
);
CREATE UNIQUE INDEX "customer_affairs_referrals_ticket_id_idempotency_key_key" ON "customer_affairs_referrals"("ticket_id", "idempotency_key");
CREATE INDEX "customer_affairs_referrals_assigned_user_id_status_due_at_idx" ON "customer_affairs_referrals"("assigned_user_id", "status", "due_at");
CREATE INDEX "customer_affairs_referrals_destination_module_status_due_at_idx" ON "customer_affairs_referrals"("destination_module", "status", "due_at");

CREATE TABLE "customer_affairs_satisfaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "ticket_id" UUID NOT NULL,
  "invitation_reference" VARCHAR(160) NOT NULL, "score" INTEGER, "comment" VARCHAR(1000),
  "submitted_by_customer" BOOLEAN NOT NULL DEFAULT false, "submitted_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_affairs_satisfaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_affairs_satisfaction_score_check" CHECK ("score" IS NULL OR "score" BETWEEN 1 AND 5),
  CONSTRAINT "customer_affairs_satisfaction_source_check" CHECK ("score" IS NULL OR "submitted_by_customer" = true)
);
CREATE UNIQUE INDEX "customer_affairs_satisfaction_invitation_reference_key" ON "customer_affairs_satisfaction"("invitation_reference");
CREATE UNIQUE INDEX "customer_affairs_satisfaction_ticket_id_key" ON "customer_affairs_satisfaction"("ticket_id");
CREATE INDEX "customer_affairs_satisfaction_ticket_id_submitted_at_idx" ON "customer_affairs_satisfaction"("ticket_id", "submitted_at");

CREATE TABLE "customer_affairs_corrective_actions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "ticket_id" UUID NOT NULL, "satisfaction_id" UUID,
  "title" VARCHAR(200) NOT NULL, "owner_user_id" UUID NOT NULL, "due_at" TIMESTAMPTZ(3) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN', "result" VARCHAR(1000), "effectiveness_review" VARCHAR(1000),
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "customer_affairs_corrective_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_affairs_corrective_actions_status_check" CHECK ("status" IN ('OPEN','IN_PROGRESS','DONE','CANCELLED'))
);
CREATE INDEX "customer_affairs_corrective_actions_owner_user_id_status_du_idx" ON "customer_affairs_corrective_actions"("owner_user_id", "status", "due_at");
CREATE INDEX "customer_affairs_corrective_actions_ticket_id_created_at_idx" ON "customer_affairs_corrective_actions"("ticket_id", "created_at");

CREATE TABLE "customer_affairs_commands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "actor_user_id" UUID NOT NULL,
  "scope" VARCHAR(80) NOT NULL, "idempotency_key" VARCHAR(160) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL, "result_entity_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_affairs_commands_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "customer_affairs_commands_actor_user_id_scope_idempotency_k_key" ON "customer_affairs_commands"("actor_user_id", "scope", "idempotency_key");
CREATE INDEX "customer_affairs_commands_result_entity_id_idx" ON "customer_affairs_commands"("result_entity_id");

CREATE TABLE "customer_affairs_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "branch_id" UUID NOT NULL, "actor_user_id" UUID,
  "entity_type" VARCHAR(48) NOT NULL, "entity_id" UUID NOT NULL, "action" VARCHAR(80) NOT NULL,
  "reason" VARCHAR(500), "trace_id" VARCHAR(160), "version" INTEGER NOT NULL,
  "before_snapshot" JSONB, "after_snapshot" JSONB,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_affairs_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_affairs_audit_events_branch_id_occurred_at_idx" ON "customer_affairs_audit_events"("branch_id", "occurred_at");
CREATE INDEX "customer_affairs_audit_events_entity_type_entity_id_occurre_idx" ON "customer_affairs_audit_events"("entity_type", "entity_id", "occurred_at");
CREATE INDEX "customer_affairs_audit_events_actor_user_id_occurred_at_idx" ON "customer_affairs_audit_events"("actor_user_id", "occurred_at");

ALTER TABLE "customer_affairs_leads" ADD CONSTRAINT "customer_affairs_leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_leads" ADD CONSTRAINT "customer_affairs_leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_leads" ADD CONSTRAINT "customer_affairs_leads_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_leads" ADD CONSTRAINT "customer_affairs_leads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_leads" ADD CONSTRAINT "customer_affairs_leads_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_tickets" ADD CONSTRAINT "customer_affairs_tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_tickets" ADD CONSTRAINT "customer_affairs_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_tickets" ADD CONSTRAINT "customer_affairs_tickets_customer_owner_user_id_fkey" FOREIGN KEY ("customer_owner_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_tickets" ADD CONSTRAINT "customer_affairs_tickets_execution_owner_user_id_fkey" FOREIGN KEY ("execution_owner_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_tickets" ADD CONSTRAINT "customer_affairs_tickets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_tickets" ADD CONSTRAINT "customer_affairs_tickets_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_timeline" ADD CONSTRAINT "customer_affairs_timeline_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "customer_affairs_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_timeline" ADD CONSTRAINT "customer_affairs_timeline_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "customer_affairs_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_timeline" ADD CONSTRAINT "customer_affairs_timeline_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_handoffs" ADD CONSTRAINT "customer_affairs_handoffs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "customer_affairs_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_handoffs" ADD CONSTRAINT "customer_affairs_handoffs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_handoffs" ADD CONSTRAINT "customer_affairs_handoffs_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_referrals" ADD CONSTRAINT "customer_affairs_referrals_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "customer_affairs_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_referrals" ADD CONSTRAINT "customer_affairs_referrals_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_referrals" ADD CONSTRAINT "customer_affairs_referrals_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_referrals" ADD CONSTRAINT "customer_affairs_referrals_responded_by_user_id_fkey" FOREIGN KEY ("responded_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_satisfaction" ADD CONSTRAINT "customer_affairs_satisfaction_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "customer_affairs_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_corrective_actions" ADD CONSTRAINT "customer_affairs_corrective_actions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "customer_affairs_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_corrective_actions" ADD CONSTRAINT "customer_affairs_corrective_actions_satisfaction_id_fkey" FOREIGN KEY ("satisfaction_id") REFERENCES "customer_affairs_satisfaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_corrective_actions" ADD CONSTRAINT "customer_affairs_corrective_actions_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_commands" ADD CONSTRAINT "customer_affairs_commands_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_audit_events" ADD CONSTRAINT "customer_affairs_audit_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_affairs_audit_events" ADD CONSTRAINT "customer_affairs_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
