import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_PERMISSION_CODES,
  DOCUMENT_PERMISSION_CODES,
  IAM_PERMISSION_CODES,
  IAM_PERMISSION_CONTRACT_VERSION,
  MASTER_DATA_PERMISSION_CODES,
  LEGAL_ENTITY_AUTHENTICATED_BASELINE_PERMISSION_CODES,
  LEGAL_ENTITY_PERMISSION_CODES,
  type AuthenticatedActor,
} from '../src';

describe('IAM public permission contract', () => {
  it('publishes the version 6 domain permission catalogs without duplicates', () => {
    expect(IAM_PERMISSION_CONTRACT_VERSION).toBe(6);
    expect(MASTER_DATA_PERMISSION_CODES).toEqual([
      'master_data.read',
      'master_data.create',
      'master_data.update',
      'master_data.status.manage',
      'master_data.export',
      'master_data.import',
      'master_data.audit.read',
      'master_data.currency_rate.create',
      'master_data.currency_rate.approve',
      'master_data.sensitive_contact.read',
      'master_data.sensitive_contact.unmask',
      'master_data.delete',
    ]);
    expect(CUSTOMER_PERMISSION_CODES).toEqual([
      'customers.read',
      'customers.create',
      'customers.update',
      'customers.merge',
      'customers.consent.manage',
      'customers.sensitive.read',
    ]);
    expect(LEGAL_ENTITY_AUTHENTICATED_BASELINE_PERMISSION_CODES).toEqual([
      'legal-entity.read',
      'legal-entity.switch',
    ]);
    expect(LEGAL_ENTITY_PERMISSION_CODES).toEqual([
      'legal-entity.read',
      'legal-entity.switch',
      'legal-entity.aggregate.read',
      'legal-entity.manage',
      'legal-entity.branding.manage',
      'legal-entity.audit.read',
      'legal-entity.document.issue',
      'legal-entity.document.reissue',
    ]);
    expect(DOCUMENT_PERMISSION_CODES).toEqual(
      expect.arrayContaining([
        'documents.list',
        'documents.metadata.read',
        'documents.file.read',
        'documents.download',
        'documents.upload',
        'documents.audit.read',
        'documents.finance.read',
        'documents.hr.read',
      ]),
    );
    expect(new Set(IAM_PERMISSION_CODES).size).toBe(
      IAM_PERMISSION_CODES.length,
    );
  });

  it('keeps domain permissions compatible with the authenticated actor', () => {
    const actor: AuthenticatedActor = {
      userId: 'user-1',
      sessionId: 'session-1',
      permissions: ['master_data.read', 'customers.sensitive.read'],
      branchIds: ['branch-1'],
    };

    expect(actor.permissions).toEqual([
      'master_data.read',
      'customers.sensitive.read',
    ]);
  });
});
