CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_user_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "source_module" VARCHAR(80) NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(160) NOT NULL,
    "href" VARCHAR(500),
    "read_at" TIMESTAMPTZ(3),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipient_user_id_read_at_occurred_at_idx"
    ON "notifications"("recipient_user_id", "read_at", "occurred_at");

CREATE INDEX "notifications_recipient_user_id_occurred_at_idx"
    ON "notifications"("recipient_user_id", "occurred_at");

CREATE INDEX "notifications_source_module_entity_type_entity_id_occurred_idx"
    ON "notifications"("source_module", "entity_type", "entity_id", "occurred_at");

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_recipient_user_id_fkey"
    FOREIGN KEY ("recipient_user_id") REFERENCES "iam_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
