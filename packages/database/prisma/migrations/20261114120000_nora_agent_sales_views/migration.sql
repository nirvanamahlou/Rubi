-- Additive Sales public read contract. No operational row mutation.
-- Role provisioning needs CREATEROLE, just like creating the private runtime
-- login; application startup never creates roles or runs migrations.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nora_agent_view_owner') THEN
    CREATE ROLE nora_agent_view_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nora_agent_reader') THEN
    CREATE ROLE nora_agent_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('nora_agent_view_owner','nora_agent_reader')
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Reserved Nora agent role has incompatible privileges';
  END IF;
END $$;
CREATE SCHEMA nora_agent AUTHORIZATION nora_agent_view_owner;
REVOKE ALL ON SCHEMA nora_agent FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO nora_agent_view_owner;
GRANT SELECT ON public.sales_contracts, public.sales_contract_passengers,
  public.sales_contract_services, public.sales_contract_price_components,
  public.sales_contract_payment_entries TO nora_agent_view_owner;

CREATE VIEW nora_agent.contracts WITH (security_barrier=true) AS
SELECT c.id, c.contract_number, c.branch_id, c.owner_user_id, c.legal_entity_id,
  c.customer_name_snapshot AS customer_name, c.trip_type::text,
  c.origin_id, c.destination_id, c.departure_date,
  c.status::text, c.reservation_status::text, c.created_at,
  c.confirmed_at, c.cancelled_at, c.updated_at
FROM public.sales_contracts c
WHERE c.hidden_at IS NULL
  AND (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb ->> 'userId') IS NOT NULL
  AND (
    (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb ->> 'companyId') IS NULL
    OR c.legal_entity_id::text = (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb ->> 'companyId')
  )
  AND (
    (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb ->> 'mode') = 'all'
    OR (
      (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb -> 'branchIds') ? c.branch_id::text
      AND (
        (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb ->> 'mode') = 'branch'
        OR (
          (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb ->> 'mode') = 'own'
          AND c.owner_user_id::text = (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb ->> 'userId')
        )
      )
    )
  );

CREATE VIEW nora_agent.passengers WITH (security_barrier=true) AS
SELECT p.id, p.contract_id, p.display_name_snapshot AS display_name, p.age_category::text
FROM public.sales_contract_passengers p JOIN nora_agent.contracts c ON c.id=p.contract_id;

CREATE VIEW nora_agent.services WITH (security_barrier=true) AS
SELECT s.id, s.contract_id, s.kind::text, s.status::text
FROM public.sales_contract_services s JOIN nora_agent.contracts c ON c.id=s.contract_id;

CREATE VIEW nora_agent.amounts WITH (security_barrier=true) AS
SELECT p.contract_id, p.currency_code,
  sum(CASE WHEN p.type::text='DISCOUNT' THEN -p.amount ELSE p.amount END)::numeric(24,4) AS amount
FROM public.sales_contract_price_components p JOIN nora_agent.contracts c ON c.id=p.contract_id
GROUP BY p.contract_id, p.currency_code;

CREATE VIEW nora_agent.payments WITH (security_barrier=true) AS
SELECT p.id, p.contract_id, p.currency_code, p.amount, p.status::text,
  p.due_at, p.finance_confirmed_at, p.created_at
FROM public.sales_contract_payment_entries p JOIN nora_agent.contracts c ON c.id=p.contract_id
WHERE (NULLIF(current_setting('nora_agent.scope', true),'')::jsonb ->> 'payments')='true';

ALTER VIEW nora_agent.contracts OWNER TO nora_agent_view_owner;
ALTER VIEW nora_agent.passengers OWNER TO nora_agent_view_owner;
ALTER VIEW nora_agent.services OWNER TO nora_agent_view_owner;
ALTER VIEW nora_agent.amounts OWNER TO nora_agent_view_owner;
ALTER VIEW nora_agent.payments OWNER TO nora_agent_view_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA nora_agent FROM PUBLIC;
GRANT USAGE ON SCHEMA nora_agent TO nora_agent_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA nora_agent TO nora_agent_reader;
