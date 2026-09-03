import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260903123000_sales_contracts_vertical_slice/migration.sql'),
  'utf8',
);
const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const seed = readFileSync(resolve(process.cwd(), 'src/permission-seed-data.ts'), 'utf8');

describe('SALES-CONTRACTS-001 migration', () => {
  it('creates the additive sales boundary with internal foreign keys', () => {
    for (const table of [
      'sales_contracts', 'sales_contract_passengers', 'sales_contract_services',
      'sales_contract_ticket_selections', 'sales_contract_hotel_selections',
      'sales_contract_price_components', 'sales_contract_payment_entries',
      'sales_reservation_requests', 'sales_contract_status_history', 'sales_contract_audit_events',
    ]) expect(migration).toContain(`CREATE TABLE "${table}"`);
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
    expect(migration).toContain('sales_contracts_owner_user_id_updated_at_idx');
    expect(migration).toContain('ON DELETE RESTRICT');
  });

  it('keeps external references opaque and protects money and check invariants', () => {
    expect(migration).toContain('sales_payment_check_bundle_check');
    expect(migration).toContain('sales_price_currency_check');
    expect(migration).not.toContain('REFERENCES "customers"');
    expect(migration).not.toContain('REFERENCES "documents"');
    expect(schema).toContain('model SalesContract');
  });

  it('adds every sales permission to the idempotent shared seed', () => {
    expect(seed).toContain("'sales.contracts.read.own'");
    expect(seed).toContain("'sales.reservation_request.create'");
    expect(seed).toContain("'sales.export'");
  });
});
