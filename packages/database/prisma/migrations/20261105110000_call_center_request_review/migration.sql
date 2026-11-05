-- Preserve one immutable follow-up receipt per request and saved real call.
-- A manager decision acknowledges receipts without changing their completion facts.
CREATE TABLE "call_center_request_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "completed_by_user_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_user_id" UUID,
    CONSTRAINT "call_center_request_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cc_request_review_ack_pair_check" CHECK (
        ("reviewed_at" IS NULL) = ("reviewed_by_user_id" IS NULL)
    ),
    CONSTRAINT "cc_request_review_ticket_fk" FOREIGN KEY ("ticket_id") REFERENCES "customer_affairs_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cc_request_review_call_fk" FOREIGN KEY ("call_id") REFERENCES "customer_affairs_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cc_request_review_completed_by_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cc_request_review_reviewed_by_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "cc_request_review_ticket_call_key" ON "call_center_request_reviews"("ticket_id", "call_id");
CREATE INDEX "cc_request_review_pending_idx" ON "call_center_request_reviews"("ticket_id", "reviewed_at", "completed_at", "id");
CREATE INDEX "cc_request_review_call_idx" ON "call_center_request_reviews"("call_id");
