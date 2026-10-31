import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it } from 'vitest';

import { cooperationEditDraft, cooperationStepIds } from './cooperation-wizard';

const organization = {
  id: 'org-1',
  resource: 'organizations',
  code: 'ORG-1',
  name: 'آژانس نمونه',
  status: 'active',
  version: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
  attributes: {
    roleCodes: 'AGENCY',
    personType: 'LEGAL',
    nationalId: '12345678901',
    registrationNumber: 'REG-1',
    economicCode: 'ECO-1',
    tourismLicenseNumber: 'LIC-1',
  },
} satisfies MasterDataRecord;

describe('cooperation wizard edit mode', () => {
  it('uses ordinary staff contact entry for agencies and preserves corporate verification', () => {
    expect(cooperationStepIds('AGENCY')).toEqual([1, 2, 5]);
    expect(cooperationStepIds('CORPORATE_CUSTOMER')).toEqual([1, 2, 3, 4, 5]);
  });
  it('prefills the registration steps from the selected agency identity', () => {
    const draft = cooperationEditDraft(organization, 'AGENCY');

    expect(draft).toMatchObject({
      legalName: 'آژانس نمونه',
      code: 'ORG-1',
      personType: 'LEGAL',
      nationalId: '12345678901',
      registrationNumber: 'REG-1',
      economicCode: 'ECO-1',
      tourismLicenseNumber: 'LIC-1',
      role: 'AGENCY',
    });
  });
});
