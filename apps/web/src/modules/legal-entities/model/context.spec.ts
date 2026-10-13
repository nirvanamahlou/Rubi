import { describe, expect, it } from 'vitest';
import type { LegalEntitySummary } from '@nora/contracts';

import {
  combinedOfficialDocumentAllowed,
  legalEntityBrand,
  legalEntityChoices,
} from './context';

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
  {
    id: '3',
    code: 'JAHAN_ACADEMIA',
    persianName: 'شرکت جهان آکادمیا',
    latinName: null,
    logoFileId: null,
    isActive: true,
    version: 1,
    brandingSnapshotVersion: 1,
    updatedAt: '2026-09-07T00:00:00.000Z',
  },
  {
    id: '4',
    code: 'GHESATI_RO',
    persianName: 'شرکت قسطی رو',
    latinName: null,
    logoFileId: null,
    isActive: true,
    version: 1,
    brandingSnapshotVersion: 1,
    updatedAt: '2026-09-07T00:00:00.000Z',
  },
];

describe('legal entity context UI model', () => {
  it('shows the three approved active companies to a normal user', () => {
    expect(
      legalEntityChoices(entities, false).map(({ value }) => value),
    ).toEqual(['GHESATI_RO', 'NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN']);
  });
  it('adds the virtual combined option only for an authorized manager', () => {
    expect(
      legalEntityChoices(entities, true).map(({ value }) => value),
    ).toEqual(['GHESATI_RO', 'NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN', 'ALL']);
    expect(legalEntityChoices(entities, true).at(-1)?.label).toBe(
      'همه شرکت‌ها — ویژه مدیران',
    );
  });
  it('never allows an official combined document', () => {
    expect(combinedOfficialDocumentAllowed('ALL')).toBe(false);
    expect(combinedOfficialDocumentAllowed('JAHAN_BASTAN')).toBe(true);
  });
  it('uses the supplied horizontal logo for Jahan Bastan', () => {
    expect(legalEntityBrand('JAHAN_BASTAN')).toEqual({
      alt: 'لوگوی شرکت جهان باستان',
      label: 'CRM شرکت جهان باستان',
      src: '/brand/jahan-bastan-transparent.png',
      width: 1254,
      height: 1254,
    });
  });
  it('keeps the Niyayesh brand for its company and the aggregate context', () => {
    expect(legalEntityBrand('NIYAYESH_SEIR_SAHAR').src).toBe(
      '/brand/niyayesh.png',
    );
    expect(legalEntityBrand('ALL').src).toBe('/brand/niyayesh.png');
  });
  it('uses a neutral company mark until logos are supplied for new companies', () => {
    expect(legalEntityBrand('JAHAN_ACADEMIA')).toMatchObject({
      label: 'CRM شرکت جهان آکادمیا',
      src: '/brand/company-placeholder.svg',
    });
    expect(legalEntityBrand('GHESATI_RO')).toMatchObject({
      label: 'CRM شرکت قسطی رو',
      src: '/brand/company-placeholder.svg',
    });
  });
});
