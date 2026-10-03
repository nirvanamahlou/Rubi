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
  MasterDataLiveForm,
  withAppendedMasterDataReference,
} from './master-data-live-form';

function renderTrain(
  mode: 'create' | 'edit' | 'view',
  lockedFields: readonly string[] = [],
) {
  return renderToStaticMarkup(
    createElement(MasterDataLiveForm, {
      definition: getMasterDataDefinition('train-types'),
      mode,
      open: true,
      lockedFields,
      ...(mode === 'create'
        ? {}
        : {
            record: {
              id: 'train-test',
              resource: 'train-types' as const,
              code: 'TRAIN_TEST',
              name: 'قطار آزمون',
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

describe('train inline canonical facility creation', () => {
  it.each(['create', 'edit'] as const)(
    'shows Add Facility without requiring a search in %s mode',
    (mode) => {
      const html = renderTrain(mode);
      expect(html).toContain('id="live-train-types-facilityIds"');
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
  });

  it('appends the saved ID without duplicating it or changing the parent draft', () => {
    const draft = {
      name: 'قطار آزمون',
      manufacturer: 'Nora Rail',
      model: 'NR-1',
      facilityIds: 'facility-1',
    };
    expect(
      withAppendedMasterDataReference(draft, 'facilityIds', 'facility-2'),
    ).toEqual({ ...draft, facilityIds: 'facility-1,facility-2' });
    expect(
      withAppendedMasterDataReference(draft, 'facilityIds', 'facility-1'),
    ).toEqual(draft);
    expect(draft.facilityIds).toBe('facility-1');
  });

  it('does not expose Add in view or locked mode', () => {
    expect(renderTrain('view')).not.toContain('افزودن امکان');
    expect(renderTrain('create', ['facilityIds'])).not.toContain(
      'افزودن امکان',
    );
  });

  it('leaves Bus Types without an inline facility action', () => {
    const html = renderToStaticMarkup(
      createElement(MasterDataLiveForm, {
        definition: getMasterDataDefinition('bus-types'),
        mode: 'create',
        open: true,
        onOpenChange: () => undefined,
        onPersist: async () => undefined,
      }),
    );
    expect(html).not.toContain('افزودن امکان');
  });
});
