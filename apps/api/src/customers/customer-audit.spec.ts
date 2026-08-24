import { describe, expect, it } from 'vitest';

import {
  childAuditSnapshot,
  customerAuditSnapshot,
  duplicateAuditSnapshot,
} from './customer-audit';

const forbiddenKeys = [
  'firstName',
  'lastName',
  'birthDate',
  'value',
  'encryptedValue',
  'encryptionIv',
  'encryptionAuthTag',
  'valueFingerprint',
  'legacyValueHash',
  'valueHash',
  'label',
  'reason',
];

function expectRedacted(snapshot: unknown) {
  const serialized = JSON.stringify(snapshot);
  for (const key of forbiddenKeys) expect(serialized).not.toContain(`"${key}"`);
  expect(serialized).not.toContain('plaintext-contact');
  expect(serialized).not.toContain('raw-address');
  expect(serialized).not.toContain('raw-consent-reason');
}

describe('Customer audit allowlists', () => {
  it('redacts create and update snapshots while retaining changed field names', () => {
    const customer = {
      id: 'customer-id',
      kind: 'PERSON',
      isActive: true,
      isCustomer: true,
      isPassenger: true,
      version: 2,
      firstName: 'raw-first',
      lastName: 'raw-last',
      birthDate: new Date(),
    };
    expectRedacted(customerAuditSnapshot(customer, []));
    const update = customerAuditSnapshot(customer, [
      'firstName',
      'birthDate',
      'displayName',
    ]);
    expect(update.changedFields).toEqual([
      'birthDate',
      'displayName',
      'firstName',
    ]);
    expect(Object.keys(update)).not.toContain('firstName');
    expect(Object.keys(update)).not.toContain('birthDate');
  });

  it.each([
    [
      'customers.contact.create',
      {
        customerId: 'customer-id',
        type: 'PHONE',
        value: 'plaintext-contact',
        encryptedValue: 'ciphertext',
        encryptionIv: 'iv',
        encryptionAuthTag: 'tag',
        valueFingerprint: 'fingerprint',
        isPrimary: true,
      },
    ],
    [
      'customers.address.create',
      {
        customerId: 'customer-id',
        type: 'HOME',
        label: 'raw-address',
        cityId: 'city-id',
      },
    ],
    [
      'customers.consent.create',
      {
        customerId: 'customer-id',
        purpose: 'MARKETING',
        channel: 'EMAIL',
        status: 'REVOKED',
        reason: 'raw-consent-reason',
      },
    ],
    [
      'customers.companion.create',
      {
        customerId: 'customer-id',
        relatedCustomerId: 'related-id',
        relationshipType: 'FAMILY',
      },
    ],
  ])('redacts %s child snapshots', (action, row) => {
    expectRedacted(childAuditSnapshot(action, row));
  });

  it('redacts duplicate review to controlled identifiers and status', () => {
    const snapshot = duplicateAuditSnapshot({
      sourceCustomerId: 'source-id',
      candidateCustomerId: 'candidate-id',
      reviewStatus: 'MERGE_PROPOSED',
      version: 2,
    });
    expectRedacted(snapshot);
    expect(snapshot).toMatchObject({
      sourceCustomerId: 'source-id',
      candidateCustomerId: 'candidate-id',
      reviewStatus: 'merge_proposed',
      mergeExecuted: false,
    });
  });
  it('keeps duplicate detection to controlled match reasons only', () => {
    const snapshot = duplicateAuditSnapshot({
      sourceCustomerId: 'source-id',
      candidateCustomerId: 'candidate-id',
      score: 60,
      reasons: ['contact-fingerprint-match'],
    });
    expectRedacted(snapshot);
    expect(snapshot).toMatchObject({
      score: 60,
      reasons: ['contact-fingerprint-match'],
      mergeExecuted: false,
    });
  });
});
