import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function productionSources() {
  const root = join(process.cwd(), 'src', 'customer-affairs');
  return readdirSync(root)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => readFileSync(join(root, file), 'utf8'))
    .join('\n');
}

describe('customer affairs operational boundary', () => {
  it('keeps cross-module access behind exported public services', () => {
    const source = productionSources();
    expect(source).toContain('CustomerAffairsApplicationPort');
    expect(source).toContain('CustomerService');
    expect(source).toContain('SalesService');
    expect(source).toContain('DocumentsService');
    expect(source).not.toMatch(
      /\.customer\.(find|count|create)|\.salesContract\.(find|count|create)|\.document\.(find|count|create)/,
    );
  });

  it('exposes a controller, service and repository for the durable slice', () => {
    const files = readdirSync(join(process.cwd(), 'src', 'customer-affairs'));
    expect(files).toContain('customer-affairs.controller.ts');
    expect(files).toContain('customer-affairs.service.ts');
    expect(files).toContain('customer-affairs.repository.ts');
    expect(files).toContain('customer-affairs.module.ts');
  });

  it('uses optimistic concurrency, idempotency and transactional audit', () => {
    const source = productionSources();
    expect(source).toContain('CONCURRENT_MODIFICATION');
    expect(source).toContain('idempotencyKey');
    expect(source).toContain('repository.transaction');
    expect(source).toContain('customerAffairsAuditEvent.create');
    expect(source).toContain('createWithinTransaction');
  });
});
