BEGIN;
ALTER TABLE customer_affairs_tickets
  ADD COLUMN call_center_contact_id uuid,
  ADD COLUMN call_center_payload text,
  ADD COLUMN call_center_key_version integer,
  ADD CONSTRAINT cc_ticket_contact_fk FOREIGN KEY (call_center_contact_id) REFERENCES customer_affairs_call_contacts(id) ON DELETE RESTRICT,
  ADD CONSTRAINT cc_ticket_private_check CHECK ((call_center_contact_id IS NULL AND call_center_payload IS NULL AND call_center_key_version IS NULL) OR (call_center_contact_id IS NOT NULL AND call_center_payload IS NOT NULL AND call_center_key_version > 0));
CREATE INDEX cc_ticket_contact_idx ON customer_affairs_tickets(call_center_contact_id, created_at);
ALTER TABLE customer_affairs_calls
  ADD COLUMN ticket_id uuid,
  ADD COLUMN outcome varchar(32),
  ADD COLUMN origin varchar(16),
  ADD CONSTRAINT cc_call_ticket_fk FOREIGN KEY (ticket_id) REFERENCES customer_affairs_tickets(id) ON DELETE RESTRICT,
  ADD CONSTRAINT cc_call_outcome_check CHECK (outcome IS NULL OR outcome IN ('ANSWERED','NO_ANSWER','BUSY','FAILED')),
  ADD CONSTRAINT cc_call_origin_check CHECK (origin IS NULL OR origin = 'MANUAL');
CREATE INDEX cc_call_ticket_idx ON customer_affairs_calls(ticket_id);
ALTER TABLE automation_tasks
  ADD COLUMN call_center_ticket_id uuid,
  ADD CONSTRAINT cc_task_ticket_fk FOREIGN KEY (call_center_ticket_id) REFERENCES customer_affairs_tickets(id) ON DELETE RESTRICT,
  ADD CONSTRAINT cc_task_source_check CHECK (call_center_ticket_id IS NULL OR ("sourceModule" = 'CALL_CENTER' AND "sourceReference" = call_center_ticket_id::text));
CREATE INDEX cc_task_ticket_idx ON automation_tasks(call_center_ticket_id);

-- Existing support SLAs stay enforced; Call Center has no inferred SLA policy.
ALTER TABLE customer_affairs_tickets DROP CONSTRAINT customer_affairs_tickets_sla_order_check;
ALTER TABLE customer_affairs_tickets ADD CONSTRAINT customer_affairs_tickets_sla_order_check
  CHECK ((category = 'CALL_CENTER_REQUEST' AND sla_policy_version = 'CALL_CENTER_NO_SLA') OR resolution_due_at > first_response_due_at);
COMMIT;
