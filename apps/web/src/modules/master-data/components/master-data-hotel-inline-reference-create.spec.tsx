import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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

import { getMasterDataDefinition } from '../model/catalog';
import {
  appendMasterDataReferenceValue,
  MasterDataLiveForm,
  withAppendedMasterDataReference,
} from './master-data-live-form';

function renderHotel(
  mode: 'create' | 'view' = 'create',
  lockedFields: readonly string[] = [],
) {
  return renderToStaticMarkup(
    createElement(MasterDataLiveForm, {
      definition: getMasterDataDefinition('hotels'),
      mode,
      open: true,
      lockedFields,
      ...(mode === 'view'
        ? {
            record: {
              id: 'hotel-test',
              resource: 'hotels' as const,
              code: 'HOTEL_TEST',
              name: 'هتل آزمون',
              version: 1,
              status: 'active' as const,
              createdAt: '2026-10-01T00:00:00.000Z',
              updatedAt: '2026-10-01T00:00:00.000Z',
              attributes: {},
            },
          }
        : {}),
      onOpenChange: () => undefined,
      onPersist: async () => undefined,
    }),
  );
}

describe('hotel inline canonical reference creation', () => {
  it('renders all three Add actions before a search and retains source fields', () => {
    const html = renderHotel();

    for (const [field, action] of [
      ['mealServiceIds', 'افزودن وعده/سرویس'],
      ['roomTypeIds', 'افزودن نوع اتاق'],
      ['facilityIds', 'افزودن امکان'],
    ] as const) {
      expect(html).toContain(`id="live-hotels-${field}"`);
      expect(html).toContain(action);
    }
    expect(getMasterDataDefinition('room-types').fields).toEqual([
      expect.objectContaining({ key: 'name', required: true }),
    ]);
    expect(
      getMasterDataDefinition('meal-services').fields.map(({ key }) => key),
    ).toEqual(['code', 'name', 'englishName', 'category', 'includedMeals']);
    expect(
      getMasterDataDefinition('meal-services').fields.find(
        ({ key }) => key === 'category',
      ),
    ).toMatchObject({
      required: true,
      options: [{ value: 'MEAL_PLAN' }, { value: 'SERVICE' }],
    });
    expect(
      getMasterDataDefinition('facilities').fields.map(({ key }) => key),
    ).toEqual(['name', 'englishName', 'category', 'displayOrder']);
    expect(
      getMasterDataDefinition('facilities').fields.find(
        ({ key }) => key === 'category',
      ),
    ).toMatchObject({ type: 'text' });
  });

  it('appends a saved canonical ID without replacing or duplicating selections', () => {
    expect(appendMasterDataReferenceValue('meal-1,meal-2', 'meal-3')).toBe(
      'meal-1,meal-2,meal-3',
    );
    expect(appendMasterDataReferenceValue('meal-1,meal-2', 'meal-2')).toBe(
      'meal-1,meal-2',
    );
    expect(appendMasterDataReferenceValue(undefined, 'meal-1')).toBe('meal-1');

    const draft = {
      name: 'هتل آزمون',
      cityId: 'city-1',
      roomTypeIds: 'room-1',
      facilityIds: 'facility-1',
    };
    expect(
      withAppendedMasterDataReference(draft, 'roomTypeIds', 'room-2'),
    ).toEqual({
      ...draft,
      roomTypeIds: 'room-1,room-2',
    });
    expect(draft.roomTypeIds).toBe('room-1');
  });

  it('does not expose Add actions in read-only mode', () => {
    const html = renderHotel('view');
    expect(html).not.toContain('افزودن وعده/سرویس');
    expect(html).not.toContain('افزودن نوع اتاق');
    expect(html).not.toContain('افزودن امکان');
  });

  it('does not expose Add actions for locked hotel references', () => {
    const html = renderHotel('create', [
      'mealServiceIds',
      'roomTypeIds',
      'facilityIds',
    ]);
    expect(html).not.toContain('افزودن وعده/سرویس');
    expect(html).not.toContain('افزودن نوع اتاق');
    expect(html).not.toContain('افزودن امکان');
  });
});
