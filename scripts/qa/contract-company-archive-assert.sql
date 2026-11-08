DO $$ BEGIN
 IF (SELECT count(*) FROM sales_contracts) <> 6 OR (SELECT sum(amount) FROM sales_contracts) <> 740.70 THEN RAISE EXCEPTION 'Records or money changed'; END IF;
 IF (SELECT count(*) FROM sales_contracts WHERE hidden_at IS NOT NULL) <> 2 THEN RAISE EXCEPTION 'Cutoff incorrect'; END IF;
 IF EXISTS (SELECT 1 FROM sales_contracts WHERE legal_entity_id <> ('00000000-0000-4000-8000-'||CASE WHEN right(id::text,1)::int IN (2,4,6) THEN '000000000002' ELSE '000000000001' END)::uuid) THEN RAISE EXCEPTION 'Classification incorrect'; END IF;
 IF (SELECT count(*) FROM sales_contract_audit_events WHERE action='sales.contract.company_archive_migration') <> 6 THEN RAISE EXCEPTION 'Audit incomplete'; END IF;
 UPDATE sales_contracts SET hidden_at=NULL WHERE right(id::text,1)='1';
 IF (SELECT count(*) FROM sales_contracts WHERE hidden_at IS NULL) <> 5 THEN RAISE EXCEPTION 'Restore failed'; END IF;
END $$;
SELECT 'classification, boundary, mixed flights, hotel-only and restoration passed' AS result;
