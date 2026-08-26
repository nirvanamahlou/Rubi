import { describe, expect, it } from 'vitest';
import type { LegalEntitySummary } from '@rubi/contracts';

import { combinedOfficialDocumentAllowed, legalEntityChoices } from './context';

const entities: LegalEntitySummary[] = [
  {
    id: '1',
    code: 'NIYAYESH_SEIR_SAHAR',
    persianName: 'شرکت نیایش سیر سحر',
    latinName: null,
    logoFileId: null,
    isActive: true,
    version: 1,
    brandingSnapshotVersion: 1,
    updatedAt: '2026-08-25T00:00:00.000Z',
  },
  {
    id: '2',
    code: 'JAHAN_BASTAN',
    persianName: 'شرکت جهان باستان',
    latinName: null,
    logoFileId: null,
    isActive: true,
    version: 1,
    brandingSnapshotVersion: 1,
    updatedAt: '2026-08-25T00:00:00.000Z',
  },
];

describe('legal entity context UI model', () => {
  it('shows exactly two real companies to a normal user', () => {
    expect(
      legalEntityChoices(entities, false).map(({ value }) => value),
    ).toEqual(['NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN']);
  });
  it('adds the virtual combined option only for an authorized manager', () => {
    expect(
      legalEntityChoices(entities, true).map(({ value }) => value),
    ).toEqual(['NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN', 'ALL']);
  });
  it('never allows an official combined document', () => {
    expect(combinedOfficialDocumentAllowed('ALL')).toBe(false);
    expect(combinedOfficialDocumentAllowed('JAHAN_BASTAN')).toBe(true);
  });
});
