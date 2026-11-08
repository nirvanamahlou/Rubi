-- Ownership is independent of branch and of the currently selected company.
BEGIN;
ALTER TABLE "sales_contracts" ADD COLUMN "legal_entity_id" UUID;
ALTER TABLE "sales_contracts" ADD COLUMN "hidden_at" TIMESTAMPTZ(3);
ALTER TABLE "sales_contracts" ADD CONSTRAINT "sales_contracts_legal_entity_id_fkey"
  FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "sales_contracts_legal_entity_id_hidden_at_departure_date_idx"
  ON "sales_contracts"("legal_entity_id", "hidden_at", "departure_date");

-- One-time, explicitly requested historical classification. New contracts use the
-- user's selected company, NOT this classification. 1405/08/01 = 2026-10-23.
-- Earlier contracts retain their last documented issuer when available.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sales_contracts) AND
     (SELECT count(*) FROM legal_entities WHERE code IN ('NIYAYESH_SEIR_SAHAR','JAHAN_BASTAN')) <> 2 THEN
    RAISE EXCEPTION 'Contract company migration requires both issuer companies';
  END IF;
END $$;

WITH classified AS (
  SELECT c.id,
    CASE WHEN c.departure_date < DATE '2026-10-23' THEN COALESCE(
      (SELECT e.id FROM sales_contract_audit_events a
       JOIN legal_entities e ON e.id::text = a.after_snapshot #>> '{company,id}'
       WHERE a.contract_id = c.id AND a.action = 'sales.contract.output_preview' AND a.outcome = 'SUCCESS'
       ORDER BY a.occurred_at DESC, a.id DESC LIMIT 1),
      (SELECT id FROM legal_entities WHERE code = 'NIYAYESH_SEIR_SAHAR'))
    ELSE (SELECT id FROM legal_entities WHERE code = CASE WHEN EXISTS (
      SELECT 1 FROM sales_contract_services s WHERE s.contract_id = c.id AND s.kind = 'FLIGHT'
      AND (s.metadata ->> 'contractFlightVersion' = '1' OR s.metadata ->> 'purchaseSupplyType' = 'FLOATING')
    ) THEN 'JAHAN_BASTAN' ELSE 'NIYAYESH_SEIR_SAHAR' END) END AS company_id,
    CASE WHEN c.departure_date < DATE '2026-10-23' THEN CURRENT_TIMESTAMP ELSE NULL END AS archived_at
  FROM sales_contracts c
), changed AS (
  UPDATE sales_contracts c SET legal_entity_id = x.company_id, hidden_at = x.archived_at
  FROM classified x WHERE x.id = c.id
  RETURNING c.*
)
INSERT INTO sales_contract_audit_events
  (id, contract_id, actor_user_id, actor_branch_id, action, outcome, reason, before_snapshot, after_snapshot, occurred_at)
SELECT gen_random_uuid(), id, owner_user_id, branch_id, 'sales.contract.company_archive_migration', 'SUCCESS',
  'Requested one-time company classification and reversible archive before 1405/08/01',
  jsonb_build_object('legalEntityId',NULL,'hiddenAt',NULL),
  jsonb_build_object('legalEntityId',legal_entity_id,'hiddenAt',hidden_at,'migration','20261108124000_contract_company_archive'),
  CURRENT_TIMESTAMP FROM changed;
COMMIT;
