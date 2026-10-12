import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { HotelProfileInformation } from './hotel-profile-information';
import {
  MasterDataLiveForm,
  masterDataFormValuesFrom,
} from './master-data-live-form';
import { getMasterDataDefinition } from '../model/catalog';
import { hotelProfileFields } from '../model/hotel-profile-fields';
import { validateMasterDataDraft } from '../model/validation';

vi.mock('@/components/ui/overlays', () => {
  const content = ({ children }: { children: ReactNode }) => children;
  return {
    Dialog: content,
    DialogContent: content,
    DialogTitle: content,
    DialogDescription: content,
    DialogClose: content,
  };
});

const record: MasterDataRecord = {
  id: 'hotel-id',
  resource: 'hotels',
  code: 'HTL-KUS-001',
  name: 'Charisma De Luxe Hotel',
  version: 1,
  status: 'active',
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
  attributes: {
    cityId: 'city-id',
    serviceLevel: 'لوکس',
    description: 'Imported description',
    hotelRules: 'Check in 14:00',
    sourceRefundRules: 'Reference refund rules',
    sourceFeatured: true,
    internalNote: null,
    sourceMainImage: '<img src=x onerror=alert(1)>',
    sourceGalleryImages: 'https://example.test/image.jpg',
  },
};

describe('imported hotel profile and editing', () => {
  it('shows source details as text, including false/empty states without fetching images', () => {
    const html = renderToStaticMarkup(
      createElement(HotelProfileInformation, { record }),
    );
    expect(html).toContain('Imported description');
    expect(html).toContain('Reference refund rules');
    expect(html).toContain('لوکس');
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
    expect(html).toContain('—');
  });
  it('hydrates every imported field and allows completing a missing note', () => {
    const definition = getMasterDataDefinition('hotels');
    const values = masterDataFormValuesFrom(definition, record);
    expect(values).toMatchObject({
      description: 'Imported description',
      serviceLevel: 'لوکس',
      sourceFeatured: 'true',
      internalNote: '',
    });
    const html = renderToStaticMarkup(
      createElement(MasterDataLiveForm, {
        definition,
        mode: 'edit',
        open: true,
        record,
        onOpenChange: () => undefined,
        onPersist: async () => undefined,
      }),
    );
    for (const field of hotelProfileFields)
      expect(html).toContain(`id="live-hotels-${field.key}"`);
    expect(html).toContain('Imported description');
    expect(html).toContain('<textarea');
    expect(
      validateMasterDataDraft('hotels', {
        ...values,
        internalNote: 'n'.repeat(1500),
      }).success,
    ).toBe(true);
    expect(
      validateMasterDataDraft('hotels', {
        ...values,
        serviceLevel: 's'.repeat(161),
      }).success,
    ).toBe(false);
  });
});
