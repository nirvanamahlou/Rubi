import { describe, expect, it } from 'vitest';
import { validateAgentSql } from './sql-policy';
import { allowedSources } from './catalog';
const sources = allowedSources(true);

describe('model-authored SQL policy', () => {
  it.each([
    'SELECT id, contract_number FROM contracts LIMIT 10',
    'SELECT currency_code,sum(amount) AS total FROM amounts GROUP BY currency_code',
    'SELECT c.id,count(p.id) AS passenger_count FROM contracts c LEFT JOIN passengers p ON c.id=p.contract_id GROUP BY c.id',
    "WITH selected AS (SELECT id FROM contracts WHERE status='CONFIRMED') SELECT count(*) AS total FROM selected",
    "SELECT count(*) AS total FROM contracts WHERE created_at >= '2026-11-01'::date AND created_at < '2026-12-01'::date",
    'SELECT status,count(*) AS total FROM payments GROUP BY status',
    'SELECT kind,count(*) AS total FROM services GROUP BY kind',
    'SELECT age_category,count(*) AS total FROM passengers GROUP BY age_category',
    'SELECT customer_name,count(*) AS total FROM contracts GROUP BY customer_name ORDER BY total DESC LIMIT 10',
    'SELECT branch_id,count(*) AS total FROM nora_agent.contracts GROUP BY branch_id',
    'SELECT reservation_status,count(*) AS total FROM contracts GROUP BY reservation_status',
    'SELECT trip_type,count(*) AS total FROM contracts GROUP BY trip_type',
    'SELECT owner_user_id,count(*) AS total FROM contracts GROUP BY owner_user_id',
    "SELECT contract_number FROM contracts WHERE customer_name ILIKE '%نمونه%'",
    "SELECT id FROM contracts WHERE status IN ('CONFIRMED','COMPLETED')",
    'SELECT contract_id,currency_code,amount FROM amounts ORDER BY amount DESC LIMIT 10',
    'SELECT contract_id,currency_code,sum(amount) AS total FROM payments GROUP BY contract_id,currency_code',
    "SELECT date_trunc('month',created_at) AS month,count(*) AS total FROM contracts GROUP BY month",
    'SELECT min(created_at) AS first_seen,max(created_at) AS last_seen FROM contracts',
    'SELECT contract_id,count(*) AS total FROM passengers GROUP BY contract_id HAVING count(*)>1',
    'SELECT count(DISTINCT contract_id) AS total FROM services',
    'SELECT c.id,a.amount,a.currency_code FROM contracts c JOIN amounts a ON a.contract_id=c.id',
    'SELECT contract_number FROM contracts WHERE confirmed_at IS NOT NULL',
    'SELECT contract_number FROM contracts WHERE cancelled_at IS NULL',
    "SELECT CASE WHEN status='CANCELLED' THEN 'cancelled' ELSE 'other' END AS category,count(*) AS total FROM contracts GROUP BY category",
    'SELECT c.id FROM contracts c WHERE c.id IN (SELECT contract_id FROM passengers)',
    'SELECT round(amount,2) AS rounded,currency_code FROM amounts',
    'SELECT amount::text AS exact_amount,currency_code FROM amounts',
    'SELECT id FROM contracts WHERE id IS NOT NULL ORDER BY created_at DESC LIMIT 20 OFFSET 20',
    "SELECT id FROM contracts WHERE status='CONFIRMED' UNION ALL SELECT id FROM contracts WHERE status='COMPLETED'",
  ])('accepts bounded reporting grammar: %s', (sql) => {
    const result = validateAgentSql(sql, sources);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sql).toContain('nora_agent');
  });
  it.each([
    'DELETE FROM contracts',
    "UPDATE contracts SET status='CANCELLED'",
    'SELECT * FROM contracts; DELETE FROM contracts',
    'WITH changed AS (DELETE FROM contracts RETURNING *) SELECT * FROM changed',
    'SELECT * FROM public.sales_contracts',
    'SELECT * FROM pg_catalog.pg_authid',
    'SELECT * FROM information_schema.tables',
    "SELECT set_config('nora_agent.scope','{}',true) FROM contracts",
    "SELECT pg_read_file('/etc/passwd') FROM contracts",
    'SELECT pg_sleep(10) FROM contracts',
    'SELECT * INTO stolen FROM contracts',
    'SELECT * FROM contracts FOR UPDATE',
    'SELECT * FROM contracts FOR SHARE',
    'WITH RECURSIVE x AS (SELECT * FROM contracts) SELECT * FROM x',
    'SELECT public.sum(amount) FROM amounts',
    'SELECT id::regclass FROM contracts',
    'SELECT random() FROM contracts',
    'SELECT * FROM payments',
    "WITH x AS (SELECT id FROM contracts) SELECT * FROM contracts c JOIN x ON set_config('nora_agent.scope','{}',true)='x'",
  ])('rejects forbidden SQL: %s', (sql) => {
    expect(() => validateAgentSql(sql, allowedSources(false))).toThrow();
  });
  it('rejects empty, oversized and source-free queries', () => {
    for (const sql of ['', 'SELECT 1', ' '.repeat(12001)])
      expect(() => validateAgentSql(sql, sources)).toThrow();
  });
  it('refuses mixed-currency aggregates and money summed after a many-side join', () => {
    expect(() =>
      validateAgentSql('SELECT sum(amount) AS total FROM amounts', sources),
    ).toThrow('CURRENCY_GROUP_REQUIRED');
    expect(() =>
      validateAgentSql(
        'SELECT a.currency_code,sum(a.amount) AS total FROM amounts a JOIN passengers p ON p.contract_id=a.contract_id GROUP BY a.currency_code',
        sources,
      ),
    ).toThrow('MONEY_FANOUT_REQUIRES_SEPARATE_QUERY');
  });
});
