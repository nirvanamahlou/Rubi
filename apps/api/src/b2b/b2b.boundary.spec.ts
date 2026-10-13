import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repository = readFileSync(
  resolve(process.cwd(), 'src/b2b/b2b.repository.ts'),
  'utf8',
);
const service = readFileSync(
  resolve(process.cwd(), 'src/b2b/b2b.service.ts'),
  'utf8',
);
const crmConnections = readFileSync(
  resolve(process.cwd(), 'src/b2b/b2b-crm-connections.service.ts'),
  'utf8',
);
const directory = readFileSync(
  resolve(process.cwd(), 'src/master-data/master-organization-directory.ts'),
  'utf8',
);

describe('B2B module boundaries', () => {
  it('does not query Sales or Finance persistence directly', () => {
    expect(repository).not.toMatch(
      /salesContract|financeRepository|receivable|payable/i,
    );
    expect(service).toContain('FINANCE_PARTY_EXPOSURE_PORT');
    expect(service).not.toContain('../finance/');
    expect(service).not.toContain('../sales/');
  });

  it('consumes agency identity through the Master Data directory', () => {
    expect(service).toContain('MasterOrganizationDirectory');
    expect(service).toContain('agencyReference');
    expect(repository).not.toContain('masterOrganization');
  });

  it('composes CRM connections through public application services', () => {
    expect(crmConnections).toContain('CustomerService');
    expect(crmConnections).toContain('SalesService');
    expect(crmConnections).toContain('ReservationsPublicService');
    expect(crmConnections).toContain('MasterOrganizationDirectory');
    expect(crmConnections).toContain('FINANCE_PARTY_EXPOSURE_PORT');
    expect(crmConnections).not.toMatch(
      /DatabaseService|@nora\/database|\.repository|Repository/,
    );
  });

  it('enforces the city-country relation and audits address writes', () => {
    expect(directory).toContain('where: { id: cityId, countryId }');
    expect(directory).toContain('masterDataAuditEvent.create');
    expect(directory).toContain('version: { increment: 1 }');
  });
});
