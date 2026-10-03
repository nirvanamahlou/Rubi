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
import { getReferenceFieldConfig } from '../model/reference-fields';
import {
  MasterDataLiveForm,
  withAppendedMasterDataReference,
} from './master-data-live-form';

function renderTransport(
  resource: 'train-types' | 'bus-types',
  mode: 'create' | 'edit' | 'view',
  lockedFields: readonly string[] = [],
) {
  return renderToStaticMarkup(
    createElement(MasterDataLiveForm, {
      definition: getMasterDataDefinition(resource),
      mode,
      open: true,
      lockedFields,
      ...(mode === 'create'
        ? {}
        : {
            record: {
              id: `${resource}-test`,
              resource,
              code: resource === 'train-types' ? 'TRAIN_TEST' : 'BUS_TEST',
              name: resource === 'train-types' ? 'قطار آزمون' : 'اتوبوس آزمون',
              version: 1,
              status: 'active' as const,
              createdAt: '2026-10-03T00:00:00.000Z',
              updatedAt: '2026-10-03T00:00:00.000Z',
              attributes: { facilityIds: 'facility-1' },
            },
          }),
      onOpenChange: () => undefined,
      onPersist: async () => undefined,
    }),
  );
}

describe('transport inline canonical facility creation', () => {
  it.each([
    ['train-types', 'create'],
    ['train-types', 'edit'],
    ['bus-types', 'create'],
    ['bus-types', 'edit'],
  ] as const)(
    'shows Add Facility without requiring a search for %s in %s mode',
    (resource, mode) => {
      const html = renderTransport(resource, mode);
      expect(html).toContain(`id="live-${resource}-facilityIds"`);
      expect(html).toContain('افزودن امکان');
    },
  );

  it('uses the canonical Facilities form definition', () => {
    expect(
      getMasterDataDefinition('facilities').fields.map(({ key, required }) => [
        key,
        Boolean(required),
      ]),
    ).toEqual([
      ['name', true],
      ['englishName', false],
      ['category', false],
      ['displayOrder', false],
    ]);
    for (const resource of ['train-types', 'bus-types'] as const)
      expect(getReferenceFieldConfig(resource, 'facilityIds')).toMatchObject({
        target: 'facilities',
        payload: 'id',
        multiple: true,
        optional: true,
      });
  });

  it.each([
    {
      name: 'قطار آزمون',
      manufacturer: 'Nora Rail',
      model: 'NR-1',
      facilityIds: 'facility-1',
    },
    {
      name: 'اتوبوس آزمون',
      manufacturer: 'Nora Bus',
      model: 'NB-1',
      facilityIds: 'facility-1',
    },
  ])(
    'appends the saved ID without duplicating it or changing the $name draft',
    (draft) => {
      expect(
        withAppendedMasterDataReference(draft, 'facilityIds', 'facility-2'),
      ).toEqual({ ...draft, facilityIds: 'facility-1,facility-2' });
      expect(
        withAppendedMasterDataReference(draft, 'facilityIds', 'facility-1'),
      ).toEqual(draft);
      expect(draft.facilityIds).toBe('facility-1');
    },
  );

  it('does not expose Add in view or locked mode', () => {
    for (const resource of ['train-types', 'bus-types'] as const) {
      expect(renderTransport(resource, 'view')).not.toContain('افزودن امکان');
      expect(
        renderTransport(resource, 'create', ['facilityIds']),
      ).not.toContain('افزودن امکان');
    }
  });
});
