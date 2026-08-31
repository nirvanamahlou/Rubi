import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MASTER_TRANSPORT_FORM_RESOURCES,
  type MasterDataRecord,
} from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/overlays', () => {
  const contents = ({ children }: { children: ReactNode }) => children;
  return {
    Dialog: contents,
    DialogContent: contents,
    DialogTitle: contents,
    DialogDescription: contents,
    DialogClose: contents,
  };
});
import { MasterDataLiveForm } from './master-data-live-form';
import { getMasterDataDefinition } from '../model/catalog';
import { getMasterDataFormFields } from '../model/form-fields';
import { getReferenceFieldConfig } from '../model/reference-fields';
import { validateMasterDataDraft } from '../model/validation';
import { serializeMasterDataListQuery } from '../api/contracts';

const expected = {
  airlines: [
    'code',
    'name',
    'englishName',
    'icaoCode',
    'countryId',
    'organizationId',
  ],
  'aircraft-types': [
    'name',
    'englishName',
    'manufacturer',
    'model',
    'bodyType',
  ],
  'baggage-rules': [
    'name',
    'airlineId',
    'cabinClassId',
    'passengerType',
    'routeScope',
    'allowance',
    'unit',
    'pieceCount',
    'validFrom',
    'validTo',
  ],
  'rail-companies': ['name', 'englishName', 'countryId', 'organizationId'],
  'train-types': [
    'name',
    'englishName',
    'manufacturer',
    'model',
    'category',
    'facilityIds',
  ],
  'bus-companies': [
    'name',
    'englishName',
    'countryId',
    'organizationId',
    'supplierId',
  ],
  'bus-types': [
    'name',
    'englishName',
    'manufacturer',
    'model',
    'serviceClass',
    'facilityIds',
  ],
};

describe('transport mockup form coverage', () => {
  it.each(MASTER_TRANSPORT_FORM_RESOURCES)(
    '%s renders every editable field and generated metadata',
    (resource) => {
      const definition = getMasterDataDefinition(resource);
      const keys = getMasterDataFormFields(definition).map(
        (field) => field.key,
      );
      for (const field of [...expected[resource], 'transportStatus'])
        expect(keys).toContain(field);
      const html = renderToStaticMarkup(
        createElement(MasterDataLiveForm, {
          definition,
          mode: 'create',
          open: true,
          onOpenChange: () => {},
          onPersist: async () => {},
        }),
      );
      expect(html).toContain('مشخصات فقط‌خواندنی');
      expect(html).toContain('نسخه');
      expect(html).toContain('آخرین تغییر');
      expect(html).toContain('وضعیت');
      expect(html).not.toContain('name="capacity"');
      expect(html).not.toContain(
        'id="live-' + resource + '-logoFileReference"',
      );
      if (resource !== 'airlines')
        expect(html).toContain('خودکار تولید می‌شود');
      if (resource === 'bus-types' || resource === 'train-types') {
        expect(html).toContain('aria-multiselectable="true"');
        expect(getReferenceFieldConfig(resource, 'facilityIds')).toMatchObject({
          target: 'facilities',
          multiple: true,
        });
      }
      if (['airlines', 'rail-companies', 'bus-companies'].includes(resource)) {
        expect(html).toContain('لوگوی مرجع');
        expect(html).toContain('اتصال سرویس');
      }
    },
  );

  it.each(MASTER_TRANSPORT_FORM_RESOURCES)(
    '%s rejects unknown status and preserves cleared selection semantics',
    (resource) => {
      expect(
        validateMasterDataDraft(resource, { transportStatus: 'BAD' }).errors
          .transportStatus,
      ).toBeTruthy();
      expect(
        validateMasterDataDraft(resource, { transportStatus: '' }).values,
      ).not.toHaveProperty('transportStatus');
    },
  );
  it('shows saved train fields, legacy amenities and clears catalog selections without a text workaround', () => {
    const resource = 'train-types';
    const record: MasterDataRecord = {
      id: 'test',
      resource,
      code: 'TRAIN_TEST',
      name: 'آزمون',
      version: 3,
      status: 'inactive',
      createdAt: '2026-08-31T00:00:00Z',
      updatedAt: '2026-08-31T00:00:00Z',
      attributes: {
        englishName: 'Test Train',
        manufacturer: 'Test Maker',
        model: 'Test Model',
        category: 'SLEEPER',
        amenities: 'legacy preserved',
        facilityIds: '00000000-0000-4000-8000-000000000001',
        transportStatus: 'UNDER_REVIEW',
      },
    };
    const html = renderToStaticMarkup(
      createElement(MasterDataLiveForm, {
        definition: getMasterDataDefinition(resource),
        mode: 'edit',
        record,
        open: true,
        onOpenChange: () => {},
        onPersist: async () => {},
      }),
    );
    expect(html).toContain('value="Test Train"');
    expect(html).toContain('legacy preserved');
    expect(html).toContain('پاک‌کردن امکانات مرجع');
    expect(html).not.toContain('id="live-train-types-amenities"');
  });
  it('sends the review filter to the API before pagination', () => {
    expect(
      serializeMasterDataListQuery({
        search: '',
        status: 'all',
        transportStatus: 'UNDER_REVIEW',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 2,
        pageSize: 25,
      }),
    ).toContain('transportStatus=UNDER_REVIEW');
  });
  it('validates baggage precision, pieces and validity without inventing capacity', () => {
    const valid = {
      name: 'Test baggage',
      airlineId: '11111111-1111-4111-8111-111111111111',
      passengerType: 'ADT',
      routeScope: 'INTERNATIONAL',
      allowance: '23.50',
      unit: 'PC',
      pieceCount: '2',
      validFrom: '2026-01-01',
      validTo: '2027-01-01',
    };
    expect(validateMasterDataDraft('baggage-rules', valid).success).toBe(true);
    for (const [key, value] of [
      ['allowance', '1.123'],
      ['allowance', '-1'],
      ['pieceCount', ''],
      ['pieceCount', '0'],
      ['validTo', '2025-01-01'],
    ] as const) {
      expect(
        validateMasterDataDraft('baggage-rules', { ...valid, [key]: value })
          .errors[key],
      ).toBeTruthy();
    }
  });
});
