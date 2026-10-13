import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it } from 'vitest';

import { cooperationEditDraft } from './cooperation-wizard';

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
