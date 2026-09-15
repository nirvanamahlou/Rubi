import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editor = readFileSync(
  resolve(process.cwd(), 'src/modules/master-data/components/master-data-airline-baggage-editor.tsx'),
  'utf8',
);
const form = readFileSync(
  resolve(process.cwd(), 'src/modules/master-data/components/master-data-live-form.tsx'),
  'utf8',
);

describe('airline baggage editing', () => {
  it('exposes adult, child and infant rules by cabin and route inside the airline form', () => {
    for (const code of ['ADT', 'CHD', 'INF']) expect(editor).toContain(`value: '${code}'`);
    for (const scope of ['ALL', 'DOMESTIC', 'INTERNATIONAL'])
      expect(editor).toContain(`value: '${scope}'`);
    expect(editor).toContain("masterDataApi.list('cabin-classes'");
    expect(editor).toContain("change('cabinClassId'");
    expect(form).toContain("definition.key === 'airlines'");
    expect(form).toContain('<MasterDataAirlineBaggageEditor');
  });

  it('persists FK-backed rules and allows editing and deactivation', () => {
    expect(editor).toContain('airlineId: airline.id');
    expect(editor).toContain("validateMasterDataDraft('baggage-rules'");
    expect(editor).toContain("masterDataApi.create('baggage-rules'");
    expect(editor).toContain("masterDataApi.update('baggage-rules'");
    expect(editor).toContain('<MasterDataPowerButton');
  });
});
