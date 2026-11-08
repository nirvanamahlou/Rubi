-- Synthetic fixtures. Run ONLY in a disposable PostgreSQL database.
CREATE TABLE legal_entities (id uuid PRIMARY KEY, code text UNIQUE);
CREATE TABLE sales_contracts (id uuid PRIMARY KEY, departure_date date NOT NULL, owner_user_id uuid, branch_id uuid, amount numeric);
CREATE TABLE sales_contract_services (contract_id uuid REFERENCES sales_contracts, kind text, metadata jsonb);
CREATE TABLE sales_contract_audit_events (id uuid PRIMARY KEY, contract_id uuid REFERENCES sales_contracts, actor_user_id uuid, actor_branch_id uuid, action text, outcome text, reason text, before_snapshot jsonb, after_snapshot jsonb, occurred_at timestamptz);
INSERT INTO legal_entities VALUES ('00000000-0000-4000-8000-000000000001','NIYAYESH_SEIR_SAHAR'),('00000000-0000-4000-8000-000000000002','JAHAN_BASTAN');
INSERT INTO sales_contracts SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, CASE WHEN n IN (1,2) THEN DATE '2026-10-22' ELSE DATE '2026-10-23' END, NULL, NULL, 123.45 FROM generate_series(1,6) n;
INSERT INTO sales_contract_audit_events VALUES (gen_random_uuid(),'00000000-0000-4000-8000-000000000002',NULL,NULL,'sales.contract.output_preview','SUCCESS',NULL,NULL,'{"company":{"id":"00000000-0000-4000-8000-000000000002"}}',now());
INSERT INTO sales_contract_services VALUES
 ('00000000-0000-4000-8000-000000000003','FLIGHT','{"purchaseSupplyType":"COMPANY_CAPACITY"}'),
 ('00000000-0000-4000-8000-000000000004','FLIGHT','{"contractFlightVersion":1}'),
 ('00000000-0000-4000-8000-000000000004','FLIGHT','{}'),
 ('00000000-0000-4000-8000-000000000005','HOTEL','{"purchaseSupplyType":"FLOATING"}'),
 ('00000000-0000-4000-8000-000000000006','FLIGHT','{"purchaseSupplyType":"FLOATING"}');
