import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it } from 'vitest';
import {
  travelReferenceFormValues,
  travelReferenceMutationValues,
  transferCapacityLabel,
  transferUsageLabel,
  validateTravelReferenceForm,
  visaValidityLabel,
} from './travel-reference-form';

const transfer = {
  name: 'ترانسفر آزمون',
  vehicleType: 'ون',
  serviceMode: 'PRIVATE',
  status: 'active',
  suggestedCapacityMin: '4',
  suggestedCapacity: '8',
};
const visa = {
  name: 'ویزای آزمون',
  visaType: 'توریستی',
  countryId: '55555555-5555-4555-8555-555555555555',
  referenceValidityMode: 'DAYS',
  referenceValidityDays: '90',
  status: 'active',
};
function record(
  attributes: MasterDataRecord['attributes'] = {},
): MasterDataRecord {
  return {
    id: 'test-record',
    resource: 'transfer-types',
    code: 'TEST',
    name: transfer.name,
    status: 'inactive',
    version: 2,
    createdAt: '2026-08-31T00:00:00Z',
    updatedAt: '2026-08-31T00:00:00Z',
    attributes,
  };
}
describe('travel reference form values', () => {
  it.each(['transfer-types', 'visa-services'] as const)(
    'initializes %s and omits server-owned metadata from mutations',
    (resource) => {
      expect(travelReferenceFormValues(resource).status).toBe('active');
      const payload = travelReferenceMutationValues(resource, {
        ...(resource === 'transfer-types' ? transfer : visa),
        code: 'FORGED',
        usageCount: '44',
        updatedAt: 'FORGED',
      });
      expect(payload).not.toHaveProperty('code');
      expect(payload).not.toHaveProperty('usageCount');
      expect(payload).not.toHaveProperty('updatedAt');
      expect(payload).not.toHaveProperty('status');
    },
  );
  it('preserves a stored minimum by omitting it from edit values and mutations', () => {
    const existing = record({
      ...transfer,
      suggestedCapacityMin: 4,
      suggestedCapacity: 8,
    });
    const values = travelReferenceFormValues('transfer-types', existing);
    expect(values).toMatchObject({
      suggestedCapacity: '8',
      status: 'inactive',
    });
    expect(values).not.toHaveProperty('suggestedCapacityMin');
    expect(
      travelReferenceMutationValues('transfer-types', values, existing),
    ).not.toHaveProperty('suggestedCapacityMin');
    expect(
      travelReferenceMutationValues('transfer-types', values, existing),
    ).not.toHaveProperty('status');
    expect(
      travelReferenceMutationValues(
        'transfer-types',
        { ...values, status: 'active' },
        existing,
      ).status,
    ).toBe('active');
  });
  it.each([
    { suggestedCapacity: '101' },
    { serviceMode: '' },
    { serviceMode: 'VIP' },
    { vehicleType: '' },
    { name: '' },
    { status: '' },
  ])('rejects invalid transfer fields: %j', (invalid) => {
    expect(
      validateTravelReferenceForm('transfer-types', { ...transfer, ...invalid })
        .success,
    ).toBe(false);
  });
  it.each([
    { referenceValidityMode: '' },
    { referenceValidityMode: 'OTHER' },
    { countryId: '' },
    { guidanceFileReference: 'DOC-20112' },
    { referenceValidityDays: '3651' },
    { status: '' },
    { visaType: '' },
  ])('rejects invalid visa fields: %j', (invalid) => {
    expect(
      validateTravelReferenceForm('visa-services', { ...visa, ...invalid })
        .success,
    ).toBe(false);
  });
  it('uses day-based visa validity and does not expose passport identity policy', () => {
    expect(
      validateTravelReferenceForm('visa-services', {
        ...visa,
        referenceValidityMode: 'PASSPORT_EXPIRY',
        referenceValidityDays: '',
      }).success,
    ).toBe(true);
    expect(
      travelReferenceFormValues(
        'visa-services',
        record({ referenceValidityDays: 90 }),
      ).referenceValidityMode,
    ).toBe('DAYS');
    const legacy = record({
      countryId: visa.countryId,
      visaType: visa.visaType,
      referenceValidityMode: 'PASSPORT_EXPIRY',
      referenceValidityDays: null,
    });
    const legacyValues = travelReferenceFormValues('visa-services', legacy);
    expect(legacyValues.referenceValidityMode).toBe('PASSPORT_EXPIRY');
    expect(
      travelReferenceMutationValues('visa-services', legacyValues, legacy),
    ).not.toHaveProperty('referenceValidityMode');
    expect(
      travelReferenceMutationValues('visa-services', visa)
        .referenceValidityMode,
    ).toBe('DAYS');
    const dayRecord = record({
      referenceValidityMode: 'DAYS',
      referenceValidityDays: 90,
    });
    const dayValues = travelReferenceFormValues('visa-services', dayRecord);
    expect(
      travelReferenceMutationValues(
        'visa-services',
        {
          ...dayValues,
          countryId: visa.countryId,
          visaType: visa.visaType,
        },
        dayRecord,
      ),
    ).not.toHaveProperty('referenceValidityMode');
    expect(visaValidityLabel(record({ referenceValidityMode: 'DAYS' }))).toBe(
      'مشخص نشده',
    );
    expect(visaValidityLabel(record({ referenceValidityDays: 90 }))).toBe(
      '۹۰ روز',
    );
    expect(visaValidityLabel(record())).toBe('مشخص نشده');
  });
  it('formats bounded, upper-only and unknown capacities correctly', () => {
    expect(
      transferCapacityLabel(
        record({ suggestedCapacityMin: 1, suggestedCapacity: 3 }),
      ),
    ).toBe('۱ تا ۳ نفر');
    expect(transferCapacityLabel(record({ suggestedCapacity: 18 }))).toBe(
      'تا ۱۸ نفر',
    );
    expect(transferCapacityLabel(record())).toBe('مشخص نشده');
  });
  it('does not substitute sample usage when the consumer is unavailable', () => {
    expect(
      transferUsageLabel(
        record({ usageStatus: 'UNAVAILABLE', usageCount: null }),
      ),
    ).toBe('در انتظار اتصال رزرو');
    expect(
      transferUsageLabel(record({ usageStatus: 'AVAILABLE', usageCount: 0 })),
    ).toBe('۰ سرویس');
  });
});
