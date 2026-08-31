import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it } from 'vitest';

import {
  getReferenceFieldConfig,
  hasOrganizationRole,
  mapReferenceOption,
  toggleOrganizationRole,
  resolveReferenceSelectorState,
} from './reference-fields';

const record: MasterDataRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  resource: 'countries',
  code: 'IR',
  name: 'ایران',
  status: 'active',
  attributes: {},
  version: 1,
  createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
};

describe('master data reference field mapping', () => {
  it('does not define an organization selector for hotels', () => {
    expect(getReferenceFieldConfig('hotels', 'organizationId')).toBeUndefined();
  });

  it('maps Country selection to its persisted id', () => {
    const config = getReferenceFieldConfig('cities', 'countryId');
    expect(config).toBeDefined();
    expect(mapReferenceOption(config!, record)).toBe(record.id);
  });

  it('maps Currency selection to its canonical code', () => {
    const config = getReferenceFieldConfig(
      'exchange-rates',
      'fromCurrencyCode',
    );
    expect(config).toBeDefined();
    expect(
      mapReferenceOption(config!, {
        ...record,
        resource: 'currencies',
        code: 'USD',
      }),
    ).toBe('USD');
  });

  it('maps geography relations to persisted identifiers', () => {
    expect(getReferenceFieldConfig('regions', 'countryId')?.target).toBe(
      'countries',
    );
    expect(getReferenceFieldConfig('cities', 'regionId')?.target).toBe(
      'regions',
    );
    expect(getReferenceFieldConfig('airports', 'cityId')?.target).toBe(
      'cities',
    );
    expect(getReferenceFieldConfig('terminals', 'airportId')?.target).toBe(
      'airports',
    );
  });

  it('publishes multi-reference selectors for hotel catalogs and members', () => {
    expect(getReferenceFieldConfig('hotels', 'facilityIds')).toMatchObject({
      target: 'facilities',
      multiple: true,
    });
    expect(
      getReferenceFieldConfig('composite-hotels', 'memberHotelIds'),
    ).toMatchObject({ target: 'hotels', multiple: true });
  });

  it('publishes Provider choice and normalized facilities for buses', () => {
    expect(
      getReferenceFieldConfig('bus-companies', 'supplierId'),
    ).toMatchObject({ target: 'suppliers', optional: true });
    expect(getReferenceFieldConfig('bus-types', 'facilityIds')).toMatchObject({
      target: 'facilities',
      multiple: true,
    });
  });

  it('filters organizations by compatible role', () => {
    const organization = {
      ...record,
      resource: 'organizations' as const,
      attributes: { roleCodes: 'AGENCY,AIRLINE' },
    };
    expect(hasOrganizationRole(organization, 'AIRLINE')).toBe(true);
    expect(hasOrganizationRole(organization, 'BROKER')).toBe(false);
  });

  it('maps multi-selected organization roles to a stable payload', () => {
    const withAgency = toggleOrganizationRole('', 'AGENCY', true);
    const withBoth = toggleOrganizationRole(
      withAgency,
      'CORPORATE_CUSTOMER',
      true,
    );
    expect(withBoth).toBe('AGENCY,CORPORATE_CUSTOMER');
    expect(toggleOrganizationRole(withBoth, 'AGENCY', false)).toBe(
      'CORPORATE_CUSTOMER',
    );
  });
  it('covers loading, empty, error and permission selector states', () => {
    expect(resolveReferenceSelectorState({ loading: true })).toBe('loading');
    expect(resolveReferenceSelectorState({ optionCount: 0 })).toBe('empty');
    expect(resolveReferenceSelectorState({ optionCount: 2 })).toBe('ready');
    expect(resolveReferenceSelectorState({ errorStatus: 500 })).toBe('error');
    expect(resolveReferenceSelectorState({ errorStatus: 403 })).toBe(
      'forbidden',
    );
  });
});
