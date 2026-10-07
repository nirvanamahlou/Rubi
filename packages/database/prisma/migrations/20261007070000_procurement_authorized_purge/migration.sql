-- Keep ordinary history immutable. Only an exact-request, transaction-local
-- capability may remove a graph that has no accepted Finance commitment.
CREATE OR REPLACE FUNCTION procurement_reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb;
  request_id uuid;
BEGIN
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME <> 'procurement_idempotency' THEN
    row_data := to_jsonb(OLD);
    IF row_data ? 'requestId' THEN
      request_id := (row_data->>'requestId')::uuid;
    ELSIF row_data ? 'orderId' THEN
      SELECT "requestId" INTO request_id FROM procurement_order
      WHERE id = (row_data->>'orderId')::uuid;
    ELSIF TG_TABLE_NAME = 'procurement_approval_decision' THEN
      SELECT snapshot."requestId" INTO request_id
      FROM procurement_approval_step step
      JOIN procurement_approval_snapshot snapshot ON snapshot.id = step."snapshotId"
      WHERE step.id = (row_data->>'stepId')::uuid;
    END IF;
    IF request_id IS NOT NULL
      AND current_setting('rubi.procurement_purge_request_id', true) = request_id::text
      AND EXISTS (SELECT 1 FROM procurement_request WHERE id = request_id)
      AND NOT EXISTS (
        SELECT 1 FROM procurement_finance_handoff
        WHERE "requestId" = request_id
          AND ("acceptedSourceId" IS NOT NULL OR status IN ('ACCEPTED', 'PAID'))
      ) THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'PROCUREMENT_APPEND_ONLY: % cannot be changed', TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;
