import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getMasterDataDefinition, masterDataCatalog } from './catalog';
import { getMasterDataFormFields } from './form-fields';
import { validateMasterDataDraft } from './validation';

describe('payment-method form fields', () => {
  it('omits code and English name without changing the reference/export catalog', () => {
    const definition = getMasterDataDefinition('payment-methods');
    expect(
      getMasterDataFormFields(definition).map((field) => field.key),
    ).toEqual([
      'name',
      'channel',
      'direction',
      'requiresManualApproval',
      'displayOrder',
      'description',
    ]);
    expect(definition.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(['code', 'englishName']),
    );
  });

  it('adds display order to every resource form', () => {
    for (const definition of masterDataCatalog) {
      if (definition.key === 'exchange-rates') continue;
      expect(
        getMasterDataFormFields(definition).map((field) => field.key),
      ).toContain('displayOrder');
    }
  });

  it('accepts visible fields while retaining the remaining required fields', () => {
    const values = { name: 'روش آزمایشی', channel: 'CASH', direction: 'BOTH' };
    const result = validateMasterDataDraft('payment-methods', values);
    expect(result.success).toBe(true);
    expect(result.values).toEqual(values);
    expect(validateMasterDataDraft('payment-methods', {}).errors).toEqual({
      name: expect.any(String),
      channel: expect.any(String),
      direction: expect.any(String),
    });
  });

  it('uses visible fields for create/edit initialization and rendering in both forms', () => {
    for (const file of ['master-data-form.tsx', 'master-data-live-form.tsx']) {
      const source = readFileSync(
        resolve(process.cwd(), 'src/modules/master-data/components', file),
        'utf8',
      );
      expect(
        source.match(/getMasterDataFormFields\(definition\)\.map/g),
      ).toHaveLength(3);
      expect(source).not.toContain('definition.fields.map');
    }
  });
});
